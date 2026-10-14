import type { ResearchStore, Trip } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { AgentEventRecorder, type TurnEnd } from "./event-recorder.js";
import type { LiveRuns } from "./live-runs.js";
import type { ModelChain } from "./model-chain.js";
import { AgentMessages } from "./prompt/index.js";
import { Retries, type RetryPolicy } from "./retry.js";
import type { BuiltAgent } from "./built-agent.js";

export type AgentEnd = "complete" | "incomplete" | "failed" | "cancelled";

export interface AgentOutcome {
  agentId: string;
  status: AgentEnd;
  text: string;
  error: string;
  trip: Trip | null;
}

/** Drives one agent to its end — a dropped stream retried on the next model in the chain — and says how it ended. */
export class AgentDriver {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly retry: RetryPolicy,
    private readonly runId: string,
    private readonly chain: ModelChain,
  ) {}

  async drive(agentId: string, built: BuiltAgent, finished: () => boolean, onTurnEnd: (message: TurnEnd) => void): Promise<AgentOutcome> {
    Trace.line(import.meta.url, "AgentDriver.drive", { agentId });
    const { agent, instructions, steps } = built;
    const { runs, runId } = this;
    runs.emit(runId, "agent.started", { agent_id: agentId });
    const recorder = new AgentEventRecorder(runs, runId, agentId, onTurnEnd, steps);
    const unsubscribe = agent.subscribe((event) => {
      try {
        recorder.record(event);
      } catch (error) {
        console.error(`research run ${runId}: event handling failed for agent ${agentId}`, error);
      }
    });
    let error = "";
    try {
      await agent.prompt(instructions);
      await agent.waitForIdle();
      await this.resumeDropped(agentId, built);
      error = agent.state.errorMessage ?? "";
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown);
    } finally {
      unsubscribe();
    }
    const trip = await this.closeAtLimit(agentId, built, finished);
    const status: AgentEnd = (await this.stopping()) ? "cancelled" : finished() ? "complete" : error ? "failed" : "incomplete";
    runs.emit(runId, "agent.ended", { agent_id: agentId, status, ...(error ? { error } : {}), ...(trip ? { breaker: trip.breaker } : {}) });
    return { agentId, status, text: recorder.text(), error, trip };
  }

  private async resumeDropped(agentId: string, { agent }: BuiltAgent): Promise<void> {
    Trace.line(import.meta.url, "AgentDriver.resumeDropped", { agentId });
    for (let attempt = 1; attempt <= this.retry.attempts; attempt++) {
      const dropped = agent.state.errorMessage ?? "";
      if (!Retries.isRetryable(dropped) || (await this.stopping())) return;
      const delayMs = Retries.backoffMs(attempt, this.retry);
      const moved = this.chain.failover(agent);
      this.runs.emit(this.runId, "run.resumed", { agent_id: agentId, error: dropped, attempt, delay_ms: delayMs, ...moved });
      await Retries.sleep(delayMs);
      if (await this.stopping()) return;
      await agent.prompt(AgentMessages.resume(dropped));
      await agent.waitForIdle();
    }
  }

  /** An agent a breaker ended: rows that fail its check are retracted and whatever it left open is gapped with why it stopped, so the run shows what it found rather than a rejected part. */
  private async closeAtLimit(agentId: string, built: BuiltAgent, finished: () => boolean): Promise<Trip | null> {
    Trace.line(import.meta.url, "AgentDriver.closeAtLimit", { agentId });
    const trip = built.breakers.tripped;
    if (!trip || finished() || (await this.stopping())) return null;
    const { gapped, retracted } = built.closeOnLimit ? await built.closeOnLimit(trip) : { gapped: [], retracted: [] };
    this.runs.emit(this.runId, "agent.limit_reached", { agent_id: agentId, limit: built.breakers.ceiling, breaker: trip.breaker, reason: trip.status, gapped, retracted });
    return trip;
  }

  private async stopping(): Promise<boolean> {
    Trace.line(import.meta.url, "AgentDriver.stopping");
    return (await this.store.getRun(this.runId))?.status === "stopping";
  }
}
