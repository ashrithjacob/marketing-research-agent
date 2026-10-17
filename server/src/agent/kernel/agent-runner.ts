import { Agent, type AgentEvent, type AgentTool } from "@earendil-works/pi-agent-core";
import type { Models } from "@earendil-works/pi-ai";

import type { CallLog, LlmCall } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { TracedTool } from "../tools/traced-tool.js";

import { CallSequence, LlmCallLog } from "./llm-call-log.js";
import type { ModelChain } from "./model-chain.js";
import { DEFAULT_RETRY, Retries, type RetryPolicy } from "./retry.js";
import { SubmitTool, type Submission } from "./submit-tool.js";
import { ToolSteps } from "./tool-steps.js";
import { TurnPolicy } from "./turn-policy.js";

export interface AgentJob<T> {
  agentId: string;
  system: string;
  instructions: string;
  tools: readonly AgentTool<any>[];
  submission: Submission<T>;
  maxTurns: number;
}

export type AgentResult<T> =
  | { status: "completed"; value: T }
  | { status: "invalid"; problems: readonly string[] }
  | { status: "failed"; error: string }
  | { status: "cancelled" };

export interface AgentRunnerDeps {
  runId: string;
  models: Models;
  chain: ModelChain;
  calls: CallLog;
  sequence: CallSequence;
  signal: AbortSignal;
  emit: (kind: string, payload: Record<string, unknown>) => void;
  onCall: (call: LlmCall) => void;
  retry?: RetryPolicy;
}

/** Drives one agent until submit accepts its answer, it runs out of turns or refusals, the run is stopped, or the model cannot be reached; a dropped stream is resumed on the next model in the chain. */
export class AgentRunner {
  constructor(private readonly deps: AgentRunnerDeps) {}

  async run<T>(job: AgentJob<T>): Promise<AgentResult<T>> {
    Trace.line(import.meta.url, "AgentRunner.run", { agentId: job.agentId });
    const { deps } = this;
    const submit = new SubmitTool(job.submission);
    const policy = new TurnPolicy(job.maxTurns, () => submit.value !== null, (text) => agent.followUp({ role: "user", content: text, timestamp: Date.now() }));
    const agent = this.build(job, submit, policy);
    const onAbort = (): void => agent.abort();
    deps.signal.addEventListener("abort", onAbort, { once: true });
    const unsubscribe = agent.subscribe((event) => this.observe(job.agentId, event));
    deps.emit("agent.started", { agent_id: job.agentId });
    let error = "";
    try {
      await agent.prompt(job.instructions);
      await agent.waitForIdle();
      error = await this.resumeDropped(agent, () => submit.value !== null);
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown);
    } finally {
      unsubscribe();
      deps.signal.removeEventListener("abort", onAbort);
    }
    const result = AgentRunner.outcome(submit, deps.signal.aborted, error, policy.reachedLimit ? job.maxTurns : null);
    deps.emit("agent.ended", { agent_id: job.agentId, status: result.status, ...(error ? { error } : {}) });
    return result;
  }

  private build<T>(job: AgentJob<T>, submit: SubmitTool<T>, policy: TurnPolicy): Agent {
    Trace.line(import.meta.url, "AgentRunner.build", { agentId: job.agentId, tools: job.tools.length });
    const { deps } = this;
    const steps = new ToolSteps();
    const log = new LlmCallLog({ runId: deps.runId, agentId: job.agentId, sequence: deps.sequence, calls: deps.calls, onCall: deps.onCall });
    return new Agent({
      streamFn: log.wrap((model, context, options) => deps.models.streamSimple(model, context, { ...options, onPayload: deps.chain.withFallbacks(options?.onPayload) })),
      sessionId: `${deps.runId}-${job.agentId}`,
      initialState: {
        systemPrompt: job.system,
        model: deps.chain.current,
        tools: [...job.tools, submit.tool()].map((tool) => TracedTool.wrap(tool, steps)),
      },
      finishTurn: policy.finishTurn,
    });
  }

  private async resumeDropped(agent: Agent, done: () => boolean): Promise<string> {
    Trace.line(import.meta.url, "AgentRunner.resumeDropped");
    const policy = this.deps.retry ?? DEFAULT_RETRY;
    for (let attempt = 1; attempt <= policy.attempts; attempt++) {
      const dropped = agent.state.errorMessage ?? "";
      if (done() || this.deps.signal.aborted || !Retries.isRetryable(dropped)) return done() ? "" : dropped;
      const moved = this.deps.chain.failover(agent);
      this.deps.emit("agent.resumed", { error: dropped, attempt, ...(moved ?? {}) });
      await Retries.sleep(Retries.backoffMs(attempt, policy));
      await agent.prompt(`Your last turn was cut off (${dropped}). Carry on from where you were.`);
      await agent.waitForIdle();
    }
    return done() ? "" : (agent.state.errorMessage ?? "");
  }

  private observe(agentId: string, event: AgentEvent): void {
    Trace.tick(import.meta.url, "AgentRunner.observe", { type: event.type });
    if (event.type === "tool_execution_start" && event.toolName !== "submit") {
      this.deps.emit("tool.called", { agent_id: agentId, tool: event.toolName, args: event.args as Record<string, unknown> });
    }
  }

  private static outcome<T>(submit: SubmitTool<T>, aborted: boolean, error: string, turnLimit: number | null): AgentResult<T> {
    Trace.line(import.meta.url, "AgentRunner.outcome", { aborted, error, turnLimit });
    if (submit.value !== null) return { status: "completed", value: submit.value };
    if (aborted) return { status: "cancelled" };
    if (error) return { status: "failed", error };
    const ending = turnLimit !== null ? `the agent reached its limit of ${turnLimit} turns without an accepted submit` : "the agent ended without an accepted submit";
    const problems = [ending, ...submit.lastProblems];
    return { status: "invalid", problems };
  }
}
