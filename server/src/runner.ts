/**
 * Owns a research run for its whole life.
 *
 * One `Agent` per run, living in this process. Every event it emits is written
 * to SQLite and then fanned out to whichever browsers are watching. That
 * ordering is not decoration:
 *
 *     Agent   ──(in-memory, this process only)──────▶  supervisor
 *     supervisor ──(SQLite, replayable, many readers)──▶  browsers
 *
 * Reading the agent's stream directly from the HTTP handler would mean a browser
 * refresh loses everything that happened before it connected, and a second tab
 * sees a different run than the first.
 *
 * **Superseded:** under hermes a run outlived this process, so `recoverRunsKilledByRestart()`
 * re-read the upstream run and settled it from what actually happened. In-process
 * that is no longer true — the agent dies with the process — so recovery can only
 * record the death honestly. See `recoverRunsKilledByRestart()`.
 */

import { Agent, type AgentEvent } from "@earendil-works/pi-agent-core";
import { createModels, type Models, type Usage } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";

import { OpenRouterPrices, RunBilling, type Pricing } from "./adapters/index.js";
import { ModelPricing } from "./agent/pricing.js";
import { PacketError, PacketExtractor, PacketValidator } from "./extract/index.js";

import {
  Clock,
  DEFAULT_REJECTED_KINDS,
  type Judgement,
  type LlmCall,
  type Node,
  type ResearchStore,
  type RunRequest,
  type SourceKind,
  type StagePacket,
  Stages,
  TERMINAL_STATUSES,
} from "./domain/index.js";
import type { Settings } from "./config/index.js";
import {
  ResearchToolset,
  TOOL_LANES,
} from "./agent/tools/index.js";
import { recordLlmCalls } from "./trace.js";
import { AgentMessages, PromptBuilder } from "./agent/prompt/index.js";
import { Frames, type EventFrame } from "./agent/frames.js";
export type { EventFrame } from "./agent/frames.js";
import { DEFAULT_RETRY, Retries, type RetryPolicy } from "./agent/retry.js";
import { UsageTotals } from "./agent/usage.js";
import { LiveRuns, type Live, type Subscriber } from "./agent/live-runs.js";
import { RunError } from "./agent/errors.js";
export { RunError } from "./agent/errors.js";

const prompts = new PromptBuilder();

/** Raised when a run cannot be started, steered or stopped. */
/** A live subscriber. `null` pushed onto the queue means "no more live frames". */
/** The tool argument the cockpit should show in a lane. */
export class RunSupervisor {
  subscribe(runId: string, subscriber: Subscriber): (() => void) | null {
    return this.runs.subscribe(runId, subscriber);
  }

  isLive(runId: string): boolean {
    return this.runs.has(runId);
  }

  async waitFor(runId: string): Promise<void> {
    await this.runs.waitFor(runId);
  }

  private readonly store: ResearchStore;
  private readonly settings: Settings;
  private readonly models: Models;
  /** Live prices and billed-cost lookups. `main.ts` starts the price refresh. */
  readonly costs: OpenRouterPrices;
  /** Packets that passed `validate_packet` mid-run, by run id. */
  private readonly validated = new Map<string, StagePacket>();
  /** Injected in tests, so a retry test does not wait out a real backoff. */
  private readonly retry: RetryPolicy;
  private readonly runs: LiveRuns;

  constructor(options: {
    store: ResearchStore;
    settings: Settings;
    models?: Models;
    costs?: OpenRouterPrices;
    retry?: RetryPolicy;
  }) {
    this.store = options.store;
    this.runs = new LiveRuns(options.store);
    this.settings = options.settings;
    this.retry = options.retry ?? DEFAULT_RETRY;
    this.costs =
      options.costs ?? new OpenRouterPrices({ apiKey: options.settings.openrouterApiKey });
    if (options.models) {
      this.models = options.models;
    } else {
      const models = createModels();
      models.setProvider(openrouterProvider());
      this.models = models;
    }
  }

  // -- lifecycle --------------------------------------------------------

  /** Create the run record, build its agent, and start watching it. */
  start(request: RunRequest): string {
    const judgements = this.store.listJudgements(true);
    const rejectKinds = effectiveRejectKinds(request, judgements);
    const modelId = request.model || this.settings.model;
    const nodes = Stages.expand(request.nodes);

    const run = this.store.createRun({
      brief: request.brief as unknown as Record<string, unknown>,
      model: modelId,
      rejectKinds,
      judgementIds: judgements.map((j) => j.id),
      nodes,
      // Review mining is stage 2; the other three nodes are stage 1.
      stage: Stages.covering(nodes) ?? 1,
    });

    const listed = this.models.getModel("openrouter", modelId);
    if (!listed) {
      const error = `unknown model ${JSON.stringify(modelId)} for provider openrouter`;
      this.store.updateRun(run.id, { status: "failed", error, ended_at: Clock.nowIso() });
      this.runs.emit(run.id, "run.failed", { error });
      throw new RunError(error);
    }
    // pi-ai prices each turn from `model.cost`; give it today's rates, not the
    // ones frozen into the package.
    const { model, pricing } = new ModelPricing(this.costs).apply(listed);

    const instructions = prompts.instructions({
      brief: request.brief,
      rejectKinds,
      judgements,
      nodes,
    });

    // A call's billed cost and its log row arrive independently — the lookup
    // starts at message_end, the row is written when the stream resolves — so
    // whichever lands second attaches the cost.
    const billed = new Map<string, number>();
    const onBilled = (responseId: string, cost: number) => {
      billed.set(responseId, cost);
      this.store.setLlmCallBilled(run.id, responseId, cost);
    };
    const streamFn = recordLlmCalls((m, c, o) => this.models.streamSimple(m, c, o), {
      runId: run.id,
      store: this.store,
      onCall: (call) => {
        const cost = billed.get(call.response_id);
        if (cost !== undefined) this.store.setLlmCallBilled(run.id, call.response_id, cost);
        this.runs.emit(run.id, "llm.call", Frames.callSummary(call));
      },
    });

    const agent = new Agent({
      streamFn,
      // One session id per run, so a cache-aware backend keeps the run's prefix
      // warm across its many turns rather than paying full price every time.
      sessionId: `research-${run.id}`,
      initialState: {
        systemPrompt: prompts.system(nodes),
        model,
        tools: new ResearchToolset({
          settings: this.settings,
          runId: run.id,
          reviewTools: nodes.includes("review_mining"),
          productSearch: nodes.includes("competitors"),
          packetCheck: {
            nodes,
            brief: request.brief,
            // First pass wins. A later draft that validates cannot replace it,
            // so a model that validates early and then trims its evidence
            // cannot overwrite the fuller packet it already had.
            onValid: (packet) => this.storeValidated(run.id, packet),
            onChecked: (valid, problems) => {
              this.store.addPacketCheck(run.id, valid, problems);
              this.runs.emit(run.id, "packet.checked", { valid, problems: [...problems] });
            },
          },
        }).build(),
      },
    });

    this.store.updateRun(run.id, {
      agent_run_id: run.id,
      session_id: `research-${run.id}`,
      status: "running",
    });
    this.runs.emit(run.id, "run.started", { model: modelId, nodes });

    const done = this.watch(run.id, agent, instructions, pricing, nodes, onBilled);
    this.runs.add(run.id, { agent, subscribers: new Set(), done });
    return run.id;
  }

  /**
   * Settle runs this process was watching when it stopped.
   *
   * Under hermes a run continued upstream and could be re-read. The agent now
   * lives here, so a process that stopped mid-run killed it: there is nothing to
   * reconcile against and pretending otherwise would invent an outcome. Marking
   * it failed with the reason is the honest record, and it is better than a row
   * that says `running` forever.
   */
  recoverRunsKilledByRestart(): void {
    for (const run of this.store.listRuns(200)) {
      if (TERMINAL_STATUSES.has(run.status)) continue;
      this.store.updateRun(run.id, {
        status: "failed",
        error: "the server restarted while this run was in progress; the run did not survive it",
        ended_at: Clock.nowIso(),
      });
      this.runs.emit(run.id, "run.failed", { error: "server restarted mid-run" });
    }
  }

  /**
   * The live agent for a run that can still be stopped or steered.
   *
   * Being in `this.live` is not enough. A run stays there after it settles, for
   * as long as its billed-cost lookups take (up to ~30s), so the event stream
   * can still carry `run.billed`. A Stop in that window used to overwrite
   * `completed` with `stopping`, and nothing ever settled it again. The stored
   * status is the truth: `settle()` writes it before billing starts.
   */

  steer(runId: string, judgement: Judgement): void {
    const live = this.runs.controllable(runId);
    live.agent.steer({
      role: "user",
      content: [{ type: "text", text: AgentMessages.steer(judgement) }],
      timestamp: Date.now(),
    } as any);
    this.runs.emit(runId, "run.steered", { judgement_id: judgement.id, text: judgement.text });
  }

  stop(runId: string): void {
    const live = this.runs.controllable(runId);
    this.store.updateRun(runId, { status: "stopping" });
    this.runs.emit(runId, "run.stopping", {});
    live.agent.abort();
  }

  async close(): Promise<void> {
    // Abandon billing lookups first, or shutdown waits out their retries.
    this.costs.stop();
    this.runs.abortAll();
    await this.runs.drain();
  }

  // -- watching ---------------------------------------------------------

  /** Run the agent to completion, recording everything it does on the way. */
  private async watch(
    runId: string,
    agent: Agent,
    instructions: string,
    pricing: Pricing,
    nodes: readonly Node[],
    onBilled: (responseId: string, cost: number) => void,
  ): Promise<void> {
    const output: string[] = [];
    let usage = UsageTotals.empty();
    const billing = new RunBilling(this.costs);
    // The rates travel with the usage they priced, so an old run's cost can be
    // read against the prices it was actually calculated from.
    const recorded = () => ({ ...usage, pricing });
    // Text is accumulated per assistant message rather than per delta: the
    // agent re-emits the whole message on each update, so appending deltas
    // would multiply the output by the number of updates.
    const messageText = new Map<string, string>();

    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      try {
        this.onAgentEvent(runId, event, messageText, output, (message) => {
          usage = UsageTotals.add(usage, message.usage);
          // Looked up now, while the run goes on, so only the last turn's lookup
          // is still pending when the run ends.
          const responseId = message.responseId;
          billing.track(responseId)?.then((cost) => {
            if (cost !== null && responseId) onBilled(responseId, cost);
          });
        });
      } catch (error) {
        // A listener that throws would abort the run. Losing one cockpit frame
        // is strictly better than losing the run that produced it.
        console.error(`research run ${runId}: event handling failed`, error);
      }
    });

    try {
      await agent.prompt(instructions);
      await agent.waitForIdle();
      for (let attempt = 1; attempt <= this.retry.attempts; attempt++) {
        const dropped = agent.state.errorMessage ?? "";
        if (!this.shouldRetry(runId, dropped)) break;
        const delayMs = Retries.backoffMs(attempt, this.retry);
        this.runs.emit(runId, "run.resumed", { error: dropped, attempt, delay_ms: delayMs });
        await Retries.sleep(delayMs);
        // The operator may have pressed Stop while we were waiting.
        if (this.store.getRun(runId)?.status === "stopping") break;
        // `prompt()` clears `errorMessage` and keeps the transcript, so this is
        // a continuation rather than a restart: the turns already paid for stay.
        await agent.prompt(AgentMessages.resume(dropped));
        await agent.waitForIdle();
      }
      if (this.lacksPacket(runId, output.join(""), agent)) {
        // Once, with tools off, so the only thing the turn can produce is text.
        agent.state.tools = [];
        this.runs.emit(runId, "run.nudged", { reason: "the run ended without a packet" });
        await agent.prompt(AgentMessages.packetNudge());
        await agent.waitForIdle();
      }
      this.settle(runId, output.join(""), recorded(), nodes, agent.state.errorMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`research run ${runId}: agent failed`, error);
      this.store.updateRun(runId, {
        status: "failed",
        error: `agent failed: ${message}`,
        output: output.join(""),
        usage: recorded(),
        ended_at: Clock.nowIso(),
      });
      this.runs.emit(runId, "run.failed", { error: message });
    } finally {
      unsubscribe();
      // A failed or cancelled run was still billed for the turns it took.
      await this.recordBilling(runId, billing);
      this.runs.closeSubscribers(runId);
      this.runs.remove(runId);
      this.validated.delete(runId);
    }
  }

  /**
   * Whether a run that died on the provider gets another continuation.
   *
   * A stream can drop mid-turn — undici reports `terminated`, the turn records
   * zero tokens, and the run used to end there. Measured: a HappyWags run lost
   * five completed turns and 15 tool calls to a socket that closed 98s into
   * turn 6. The transcript is intact in the agent, so asking it to carry on is
   * one call against a run that has already cost dozens.
   *
   * Anything but a `TERMINAL_ERROR` is retried — see there for why the default
   * is "try again" rather than "recognise it first". pi-agent-core has no retry
   * of its own, so this is where it goes.
   */
  private shouldRetry(runId: string, errorMessage: string): boolean {
    if (!Retries.isRetryable(errorMessage)) return false;
    return this.store.getRun(runId)?.status !== "stopping";
  }

  /**
   * Whether a run that ended cleanly left no packet object to read at all.
   * A packet that is there but breaks the contract is not this case: that is
   * an `invalid` run, and asking again would hide what the model got wrong.
   */
  private lacksPacket(runId: string, output: string, agent: Agent): boolean {
    // Already validated mid-run: there is nothing to ask for.
    if (this.validated.has(runId)) return false;
    // After the retry budget is spent the agent still holds the whole
    // transcript, and a run that fetched 30 pages is worth one more ask before
    // it is written off. If that ask fails too, `errorMessage` is set again and
    // the run settles as `failed` with it. A run whose provider never answered
    // at all has nothing to salvage, so a tool result is the bar: it means the
    // run actually gathered something.
    if (agent.state.errorMessage && !agent.state.messages.some((m) => m.role === "toolResult")) {
      return false;
    }
    if (this.store.getRun(runId)?.status === "stopping") return false;
    try {
      new PacketExtractor().extract(output);
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Add what OpenRouter charged to the run, once every lookup has answered or
   * given up. The run has already settled: its status never waits on billing.
   */
  private async recordBilling(runId: string, billing: RunBilling): Promise<void> {
    try {
      const billed = await billing.settle();
      if (!billed) return;
      const usage = this.store.getRun(runId)?.usage ?? {};
      this.store.updateRun(runId, { usage: { ...usage, billed } });
      this.runs.emit(runId, "run.billed", { billed });
    } catch (error) {
      console.error(`research run ${runId}: recording the billed cost failed`, error);
    }
  }

  private onAgentEvent(
    runId: string,
    event: AgentEvent,
    messageText: Map<string, string>,
    output: string[],
    onTurnEnd: (message: { usage?: Usage; responseId?: string }) => void,
  ): void {
    switch (event.type) {
      case "message_update":
      case "message_end": {
        const message = event.message as any;
        if (message?.role !== "assistant") return;
        const text: string = (message.content ?? [])
          .filter((c: any) => c?.type === "text")
          .map((c: any) => c.text ?? "")
          .join("");
        const key = String(message.responseId ?? message.timestamp ?? messageText.size);
        const already = messageText.get(key) ?? "";
        if (text.length > already.length) {
          const delta = text.slice(already.length);
          messageText.set(key, text);
          if (delta) this.runs.emit(runId, "message.delta", { delta });
        }
        if (event.type === "message_end") {
          // The packet is read from the whole transcript's assistant text, so
          // each finished message contributes once, in order.
          output.push(messageText.get(key) ?? text);
          messageText.delete(key);
          onTurnEnd(message);
          const thinking: string = (message.content ?? [])
            .filter((c: any) => c?.type === "thinking")
            .map((c: any) => c.thinking ?? c.text ?? "")
            .join("");
          if (thinking.trim()) this.runs.emit(runId, "reasoning.available", { text: thinking });
        }
        return;
      }
      case "tool_execution_start":
        this.runs.emit(runId, "tool.started", {
          tool: event.toolName,
          preview: Frames.toolPreview(event.toolName, event.args),
          lane: TOOL_LANES[event.toolName] ?? "other",
        });
        return;
      case "tool_execution_end":
        this.runs.emit(runId, "tool.completed", {
          tool: event.toolName,
          error: Boolean(event.isError),
          lane: TOOL_LANES[event.toolName] ?? "other",
        });
        return;
      default:
        return;
    }
  }

  /**
   * The agent finished: parse the packet or fail loudly.
   *
   * `invalid` is a distinct status from `failed` on purpose. The agent finished
   * and produced something, and what it produced broke the contract — that is
   * the most informative failure there is, and collapsing it into "failed" would
   * hide it.
   */
  private settle(
    runId: string,
    output: string,
    usage: Usage & { pricing: Pricing },
    nodes: readonly Node[],
    errorMessage?: string,
  ): void {
    const run = this.store.getRun(runId);
    const stopping = run?.status === "stopping";

    this.store.updateRun(runId, { output, usage, ended_at: Clock.nowIso() });

    // The agent validated a packet mid-run, so the run has its deliverable
    // whatever happened afterwards. Do not extract, do not re-validate.
    const validated = this.validated.get(runId);
    if (validated && !stopping) {
      this.store.updateRun(runId, { status: "completed", error: "" });
      this.countJudgementApplications(runId, validated);
      this.runs.emit(runId, "run.completed", { usage });
      if (errorMessage) {
        // Honest about both halves: the artefact is valid, the run did not end
        // cleanly. Calling this `failed` would be a lie about the packet.
        this.runs.emit(runId, "run.ended_early", { error: errorMessage });
      }
      return;
    }

    if (errorMessage) {
      // An abort the operator asked for is a cancellation, not a failure.
      const status = stopping ? "cancelled" : "failed";
      this.store.updateRun(runId, { status, error: errorMessage });
      this.runs.emit(runId, `run.${status}`, { error: errorMessage });
      return;
    }
    if (stopping) {
      this.store.updateRun(runId, { status: "cancelled", error: "stopped by the operator" });
      this.runs.emit(runId, "run.cancelled", {});
      return;
    }

    let parsed: StagePacket;
    try {
      parsed = new PacketValidator().parse(output, nodes, run?.brief);
    } catch (error) {
      if (!(error instanceof PacketError)) throw error;
      this.store.updateRun(runId, { status: "invalid", error: error.message });
      this.runs.emit(runId, "packet.invalid", { error: error.message });
      return;
    }
    this.store.updateRun(runId, {
      status: "completed",
      packet: parsed,
      error: "",
      // Read out of the final message rather than checked during the run. When
      // this stops appearing, `extract()` and its scanners can go.
      packet_source: "output",
    });
    this.countJudgementApplications(runId, parsed);
    this.runs.emit(runId, "run.completed", { usage });
    this.runs.emit(runId, "packet.ready", {
      sources: parsed.sources.length,
      excerpts: parsed.excerpts.length,
      gaps: parsed.gaps.length,
    });
  }

  /**
   * Keep the first packet that passed the contract mid-run.
   *
   * Written the moment it validates, not at the end: three of the five runs lost
   * in the week to 2026-09-21 had a good packet in hand when they died — to a
   * dropped stream, to a final turn that rambled instead of emitting, to fences
   * that did not pair. After this point none of those can take it away.
   */
  private storeValidated(runId: string, packet: StagePacket): void {
    if (this.validated.has(runId)) return;
    this.validated.set(runId, packet);
    this.store.updateRun(runId, { packet, packet_source: "tool", error: "" });
    this.runs.emit(runId, "packet.ready", {
      sources: packet.sources.length,
      excerpts: packet.excerpts.length,
      gaps: packet.gaps.length,
      via: "tool",
    });
  }

  /** "Applied 4 times" must be a count of real rejections, not a claim. */
  private countJudgementApplications(runId: string, parsed: StagePacket): void {
    const run = this.store.getRun(runId);
    if (!run) return;
    const byId = new Map(this.store.listJudgements().map((j) => [j.id, j]));
    for (const judgementId of run.judgement_ids) {
      const judgement = byId.get(judgementId);
      if (!judgement || judgement.rejects_kinds.length === 0) continue;
      const hits = parsed.sources.filter(
        (s) => !s.admitted && judgement.rejects_kinds.includes(s.kind),
      ).length;
      if (hits > 0) this.store.bumpJudgement(judgementId, hits);
    }
  }

  // -- fan-out ----------------------------------------------------------

  /** Persist first, then fan out. Order matters on a crash. */

  /** A live feed, or null when the run is no longer running here. */

  /** Await a run's completion. Tests need it; nothing in the HTTP path does. */

}

/**
 * Defaults, overridden by the request, widened by every source rule.
 *
 * A judgement only ever adds. Removing a default rejection is an explicit
 * `reject_kinds` on the request, so a standing rule can never quietly make the
 * corpus wider — which is the incentive §6.2-4 of `spec.md` warns about.
 */
export function effectiveRejectKinds(
  request: RunRequest,
  judgements: readonly Judgement[],
): SourceKind[] {
  const kinds: SourceKind[] =
    request.reject_kinds.length > 0 ? [...request.reject_kinds] : [...DEFAULT_REJECTED_KINDS];
  for (const judgement of judgements) {
    for (const kind of judgement.rejects_kinds) {
      if (!kinds.includes(kind)) kinds.push(kind);
    }
  }
  return kinds;
}
