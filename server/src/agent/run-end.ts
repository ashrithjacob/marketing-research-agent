import { Clock, type ResearchStore, type RunStatus, type StageStates } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { RunEvents } from "./pipeline/run-events.js";

export type FinalStatus = Extract<RunStatus, "completed" | "invalid" | "failed" | "cancelled">;

export interface RunVerdict {
  status: FinalStatus;
  error: string;
}

/** The only place a run gets its final status: what it paid is totalled from its charges first, so an ended run always carries its cost. */
export class RunEnd {
  constructor(
    private readonly store: ResearchStore,
    private readonly events: RunEvents,
  ) {}

  static verdict(states: StageStates, stopped: boolean): RunVerdict {
    Trace.line(import.meta.url, "RunEnd.verdict", { stopped });
    if (stopped) return { status: "cancelled", error: "" };
    const failed = Object.entries(states).filter(([, state]) => state.status === "failed");
    if (failed.length > 0) return { status: "failed", error: failed.map(([name, state]) => `${name}: ${state.error}`).join("; ") };
    const invalid = Object.entries(states).filter(([, state]) => state.status === "invalid");
    if (invalid.length > 0) return { status: "invalid", error: invalid.map(([name, state]) => `${name}: ${state.error}`).join("; ") };
    return { status: "completed", error: "" };
  }

  async end(runId: string, verdict: RunVerdict): Promise<void> {
    Trace.line(import.meta.url, "RunEnd.end", { runId, status: verdict.status });
    const charges = await this.store.charges.list(runId);
    const priced = charges.filter((charge) => charge.usd !== null);
    const cost = priced.length === 0 ? null : priced.reduce((sum, charge) => sum + (charge.usd ?? 0), 0);
    await this.store.runs.updateRun(runId, { status: verdict.status, error: verdict.error, cost_usd: cost, ended_at: Clock.nowIso() });
    await this.events.emit(runId, "run.ended", { status: verdict.status, error: verdict.error, cost_usd: cost, unpriced_charges: charges.length - priced.length });
    await this.events.flushed(runId);
  }
}
