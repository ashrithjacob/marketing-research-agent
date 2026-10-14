import { RunWrapUp } from "../run-wrap-up.js";
import { RunEnd, type RunEnding } from "../run-end.js";
import type { LiveRuns } from "../live-runs.js";
import { RunBilling, type OpenRouterPrices } from "../../adapters/index.js";
import { TERMINAL_STATUSES, type ResearchStore, type Trip } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { TaskReadings } from "./task-readings.js";
import type { TaskSignals } from "./task-signals.js";
import type { TaskWork, TaskWorks } from "./task-work.js";

/** How a task's run ends: through RunEnd, `partial` with gaps when a breaker stopped it, then billed from what OpenRouter charged for each call. */
export class TaskEnd {
  constructor(
    private readonly deps: { store: ResearchStore; runs: LiveRuns; costs: OpenRouterPrices; works: TaskWorks; signals: TaskSignals; readings: TaskReadings },
  ) {}

  async finish(runId: string, seen: Trip | null, error: string): Promise<string> {
    Trace.line(import.meta.url, "TaskEnd.finish", { runId, breaker: seen?.breaker ?? null, error });
    const { store, works, signals, readings } = this.deps;
    const run = await store.getRun(runId);
    if (!run || TERMINAL_STATUSES.has(run.status)) return run?.status ?? "missing";
    const work = await works.of(runId);
    const unmet = (await work.check.problems()).length > 0;
    const trip = seen ?? signals.tripped(runId) ?? (unmet ? await readings.trip(runId, work.contract, work.ceiling, Date.now()) : null);
    return this.end(work, await this.ending(work, trip, error));
  }

  async stop(runId: string): Promise<string> {
    Trace.line(import.meta.url, "TaskEnd.stop", { runId });
    const run = await this.deps.store.getRun(runId);
    if (!run || TERMINAL_STATUSES.has(run.status)) return run?.status ?? "missing";
    return this.end(await this.deps.works.of(runId), { kind: "stopped", reason: "stopped by the operator" });
  }

  private async ending(work: TaskWork, trip: Trip | null, error: string): Promise<RunEnding> {
    Trace.line(import.meta.url, "TaskEnd.ending", { runId: work.runId, breaker: trip?.breaker ?? null });
    if (trip) {
      const { gapped, retracted } = await work.close(trip);
      this.deps.runs.emit(work.runId, "agent.limit_reached", { agent_id: work.agentId, limit: work.ceiling, breaker: trip.breaker, reason: trip.status, gapped, retracted });
      return { kind: "cut_short", trips: [trip] };
    }
    return error ? { kind: "crashed", error } : { kind: "settled" };
  }

  private async end(work: TaskWork, ending: RunEnding): Promise<string> {
    Trace.line(import.meta.url, "TaskEnd.end", { runId: work.runId, ending: ending.kind });
    const { store, runs } = this.deps;
    await work.calls.written();
    const status = await new RunEnd(store, runs).end(work.assembly, ending, { usage: await this.usage(work.runId) });
    await new RunWrapUp(store, runs, work.runId).recordBilling(await this.billing(work.runId));
    return status;
  }

  private async usage(runId: string): Promise<Record<string, number>> {
    Trace.line(import.meta.url, "TaskEnd.usage", { runId });
    const totals: Record<string, number> = {};
    for (const call of await this.deps.store.listLlmCalls(runId)) {
      for (const [key, value] of Object.entries(call.usage)) if (typeof value === "number") totals[key] = (totals[key] ?? 0) + value;
    }
    return totals;
  }

  /** Every call of the run looked up again at OpenRouter, so a restart that lost a pending lookup still bills the run in full. */
  private async billing(runId: string): Promise<RunBilling> {
    Trace.line(import.meta.url, "TaskEnd.billing", { runId });
    const billing = new RunBilling(this.deps.costs);
    const writes = (await this.deps.store.listLlmCalls(runId)).map(async (call) => {
      const generation = await billing.track(call.response_id);
      if (generation) await this.deps.store.setLlmCallGeneration(runId, call.response_id, generation);
    });
    await Promise.all(writes);
    return billing;
  }
}
