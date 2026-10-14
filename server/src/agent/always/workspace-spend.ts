import { Scope, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** What a brand has spent today, billed: every paid call's charge and every model call OpenRouter has priced, over the runs made today (UTC), and what watchers spent today outside any run. */
export class WorkspaceSpend {
  constructor(private readonly store: ResearchStore) {}

  async today(workspaceId: string, now = new Date()): Promise<number> {
    Trace.line(import.meta.url, "WorkspaceSpend.today", { workspaceId });
    const day = now.toISOString().slice(0, 10);
    const runs = (await this.store.listRuns(Scope.of(workspaceId), 200)).filter((run) => run.created_at.slice(0, 10) === day);
    let total = 0;
    for (const run of runs) {
      for (const charge of await this.store.charges.list(run.id)) total += charge.usd ?? 0;
      for (const call of await this.store.listLlmCalls(run.id)) total += call.generation?.cost ?? 0;
    }
    for (const charge of await this.store.watch.charges(workspaceId, `${day}T00:00:00`)) total += charge.usd ?? 0;
    return total;
  }
}
