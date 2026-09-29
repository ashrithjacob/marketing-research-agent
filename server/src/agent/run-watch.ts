import type { Agent } from "@earendil-works/pi-agent-core";

import { OpenRouterPrices, RunBilling } from "../adapters/index.js";
import { Clock, stagePacketSchema, type Generation, type Node, type ResearchStore } from "../domain/index.js";

import { AgentEventRecorder } from "./event-recorder.js";
import type { LedgerPacket } from "./ledger-packet.js";
import type { LiveRuns } from "./live-runs.js";
import { AgentMessages } from "./prompt/index.js";
import { Retries, type RetryPolicy } from "./retry.js";
import type { ToolSteps } from "./tool-steps.js";
import type { ModelChain } from "./model-chain.js";
import { RunSettlement } from "./run-settlement.js";
import type { StageOneListings } from "./stage-one-listings.js";
import { UsageTotals } from "./usage.js";
import { Trace } from "../trace/index.js";

/** Drives one run's agent to the end: retries, settlement, the Amazon listings of what it found, billing. */
export class RunWatch {
  readonly settlement: RunSettlement;

  constructor(
    private readonly options: {
      store: ResearchStore;
      runs: LiveRuns;
      costs: OpenRouterPrices;
      retry: RetryPolicy;
      runId: string;
      packet: LedgerPacket;
      steps?: ToolSteps;
      chain: ModelChain;
      nodes: readonly Node[];
      listings?: StageOneListings;
    },
  ) {
    Trace.line(import.meta.url, "RunWatch.constructor");
    this.settlement = new RunSettlement(options.store, options.runs, options.runId, options.packet);
  }

  async run(
    agent: Agent,
    instructions: string,
    onGeneration: (responseId: string, generation: Generation) => void,
  ): Promise<void> {
    Trace.line(import.meta.url, "RunWatch.run", { agent, instructions, onGeneration });
    const { store, runs, costs, retry, runId, chain } = this.options;
    let usage = UsageTotals.empty();
    const billing = new RunBilling(costs);
    const recorded = () => ({ ...usage, pricing: chain.pricing });
    const recorder = new AgentEventRecorder(runs, runId, (message) => {
      usage = UsageTotals.add(usage, message.usage);
      const responseId = message.responseId;
      billing.track(responseId)?.then((generation) => {
        if (generation !== null && responseId) onGeneration(responseId, generation);
      });
    }, this.options.steps);
    const unsubscribe = agent.subscribe((event) => {
      try {
        recorder.record(event);
      } catch (error) {
        console.error(`research run ${runId}: event handling failed`, error);
      }
    });

    try {
      await agent.prompt(instructions);
      await agent.waitForIdle();
      for (let attempt = 1; attempt <= retry.attempts; attempt++) {
        const dropped = agent.state.errorMessage ?? "";
        if (!this.shouldRetry(dropped)) break;
        const delayMs = Retries.backoffMs(attempt, retry);
        const moved = chain.failover(agent);
        runs.emit(runId, "run.resumed", { error: dropped, attempt, delay_ms: delayMs, ...moved });
        await Retries.sleep(delayMs);
        if (store.getRun(runId)?.status === "stopping") break;
        await agent.prompt(AgentMessages.resume(dropped));
        await agent.waitForIdle();
      }
      this.settlement.settle(recorder.text(), recorded(), agent.state.errorMessage);
      await this.lookUpListings();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`research run ${runId}: agent failed`, error);
      store.updateRun(runId, {
        status: "failed",
        error: `agent failed: ${message}`,
        output: recorder.text(),
        usage: recorded(),
        ended_at: Clock.nowIso(),
      });
      runs.emit(runId, "run.failed", { error: message });
    } finally {
      unsubscribe();
      await this.recordBilling(billing);
      runs.closeSubscribers(runId);
      runs.remove(runId);
    }
  }

  private shouldRetry(errorMessage: string): boolean {
    Trace.line(import.meta.url, "RunWatch.shouldRetry", { errorMessage });
    if (!Retries.isRetryable(errorMessage)) return false;
    return this.options.store.getRun(this.options.runId)?.status !== "stopping";
  }

  /** After a completed competitors run, never before: an Apify search can wait minutes, and must not hold the run's status. */
  private async lookUpListings(): Promise<void> {
    Trace.line(import.meta.url, "RunWatch.lookUpListings");
    const { store, runs, runId, nodes, listings } = this.options;
    if (!listings?.available || !nodes.includes("competitors")) return;
    const run = store.getRun(runId);
    const packet = stagePacketSchema.safeParse(run?.packet);
    if (run?.status !== "completed" || !packet.success) return;
    try {
      const rows = await listings.lookUp(runId, packet.data, (charge) =>
        runs.emit(runId, "apify.charged", { actor: charge.actor, usd: charge.usd, status: charge.status }),
      );
      runs.emit(runId, "packet.listings", { total: rows.length, matched: rows.filter((row) => row.matches).length });
    } catch (error) {
      runs.emit(runId, "packet.listings", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async recordBilling(billing: RunBilling): Promise<void> {
    Trace.line(import.meta.url, "RunWatch.recordBilling", { billing });
    const { store, runs, runId } = this.options;
    try {
      const billed = await billing.settle();
      if (!billed) return;
      const usage = store.getRun(runId)?.usage ?? {};
      store.updateRun(runId, { usage: { ...usage, billed } });
      runs.emit(runId, "run.billed", { billed });
    } catch (error) {
      console.error(`research run ${runId}: recording the billed cost failed`, error);
    }
  }
}
