import type { Corpus } from "../../adapters/corpus.js";
import { Breakers, Primitives, type BreakerReadings, type ResearchStore, type TaskContract, type Trip } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** A task's breaker readings, from the research store and the corpus, so a restarted process reads what the last one counted. Progress is a new ledger row or a page archived for the first time. */
export class TaskReadings {
  constructor(
    private readonly store: ResearchStore,
    private readonly corpus: Corpus,
  ) {}

  /** `worker` is the agent whose responses count; the stop_when judge's calls are billed but are not the worker's turns. */
  async read(runId: string, now: number, worker = "research"): Promise<BreakerReadings> {
    Trace.line(import.meta.url, "TaskReadings.read", { runId, worker });
    const [run, calls, rows, checks, charges, pages, events] = await Promise.all([
      this.store.getRun(runId),
      this.store.listLlmCalls(runId),
      this.store.findings.list(runId),
      this.store.listPacketChecks(runId),
      this.store.charges.list(runId),
      this.corpus.pages(runId),
      this.store.listEvents(runId),
    ]);
    const answeredAt = events.filter((e) => e.kind === "run.answered").map((e) => e.created_at);
    const lastProgress = [...rows.map((row) => row.created_at), pages.newest, ...answeredAt].reduce((latest, at) => (at > latest ? at : latest), "");
    const turns = calls.filter((call) => call.agent_id === worker);
    const billed = calls.reduce((sum, call) => sum + (call.generation?.cost ?? 0), 0);
    const charged = charges.reduce((sum, charge) => sum + (charge.usd ?? 0), 0);
    return {
      responses: turns.length,
      quietResponses: turns.filter((call) => call.started_at > lastProgress).length,
      refusedFinishes: checks.filter((check) => !check.valid).length,
      spentUsd: billed + charged,
      minutes: run ? (now - Date.parse(run.created_at) - TaskReadings.waitedMs(events, now)) / 60000 : 0,
    };
  }

  /** Time spent waiting for the owner's answers, which the time cap does not count. */
  static waitedMs(events: readonly { kind: string; created_at: string }[], now: number): number {
    Trace.line(import.meta.url, "TaskReadings.waitedMs", { events: events.length });
    let waited = 0;
    let since: number | null = null;
    for (const event of events) {
      if (event.kind === "run.asked") since = Date.parse(event.created_at);
      if (event.kind === "run.answered" && since !== null) {
        waited += Date.parse(event.created_at) - since;
        since = null;
      }
    }
    return since === null ? waited : waited + (now - since);
  }

  async trip(runId: string, contract: TaskContract, stepCeiling: number, now: number): Promise<Trip | null> {
    Trace.line(import.meta.url, "TaskReadings.trip", { runId, stepCeiling });
    const limits = { stepCeiling, maxUsd: contract.budget.max_usd, maxMinutes: contract.budget.max_minutes };
    return Breakers.trip(await this.read(runId, now, Primitives.role(contract).id), limits);
  }
}
