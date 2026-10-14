import { Breakers, type BreakerReadings, type ResearchStore, type TaskContract, type Trip } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** A task's breaker readings, all from the research store, so a restarted process reads what the last one counted. */
export class TaskReadings {
  constructor(private readonly store: ResearchStore) {}

  async read(runId: string, now: number): Promise<BreakerReadings> {
    Trace.line(import.meta.url, "TaskReadings.read", { runId });
    const [run, calls, rows, checks, charges] = await Promise.all([
      this.store.getRun(runId),
      this.store.listLlmCalls(runId),
      this.store.findings.list(runId),
      this.store.listPacketChecks(runId),
      this.store.charges.list(runId),
    ]);
    const lastRow = rows.reduce((latest, row) => (row.created_at > latest ? row.created_at : latest), "");
    const billed = calls.reduce((sum, call) => sum + (call.generation?.cost ?? 0), 0);
    const charged = charges.reduce((sum, charge) => sum + (charge.usd ?? 0), 0);
    return {
      responses: calls.length,
      quietResponses: calls.filter((call) => call.started_at > lastRow).length,
      refusedFinishes: checks.filter((check) => !check.valid).length,
      spentUsd: billed + charged,
      minutes: run ? (now - Date.parse(run.created_at)) / 60000 : 0,
    };
  }

  async trip(runId: string, contract: TaskContract, stepCeiling: number, now: number): Promise<Trip | null> {
    Trace.line(import.meta.url, "TaskReadings.trip", { runId, stepCeiling });
    const limits = { stepCeiling, maxUsd: contract.budget.max_usd, maxMinutes: contract.budget.max_minutes };
    return Breakers.trip(await this.read(runId, now), limits);
  }
}
