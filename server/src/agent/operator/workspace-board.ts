import { Brands, Runs, Scope, type Board, type Card, type ResearchRun, type ResearchStore, type TaskCard } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { AlwaysOnDesk } from "../always/always-on-desk.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

/** The board, read from the research store, where a task's progress is written as it happens: its findings, its calls, its status, and the question it waits on. */
export class WorkspaceBoard {
  constructor(
    private readonly store: ResearchStore,
    private readonly tasks: TaskSupervisor,
    private readonly alwaysOn: () => AlwaysOnDesk,
  ) {}

  async snapshot(workspaceId: string): Promise<Board> {
    Trace.line(import.meta.url, "WorkspaceBoard.snapshot", { workspaceId });
    const scope = Scope.of(workspaceId);
    const plans = await this.store.plans.list(scope, 5);
    const planRuns = new Set(plans.flatMap((p) => [p.stage_one_run_id, ...p.stages.map((s) => s.run_id)]).filter(Boolean));
    const runs = (await this.store.listRuns(scope, 50)).filter((run) => run.contract || planRuns.has(run.id)).slice(0, 25);
    const cards = await this.store.cards.list(scope, 50);
    const today = new Date().toISOString().slice(0, 10);
    const shown = cards.filter((card) => card.status === "open" || card.resolved_at.slice(0, 10) === today);
    return {
      plans,
      tasks: await Promise.all(runs.map((run) => this.card(run))),
      cards: shown,
      cards_today: cards.filter((card) => card.created_at.slice(0, 10) === today).length,
      feedback: await this.store.feedback.list(scope, 30),
      memory: await this.store.memory.current(scope),
      always_on: await this.alwaysOn().status(workspaceId),
      schedules: await this.store.schedules.list(workspaceId),
      drafts: await this.store.drafts.list(scope, 10),
      card_brands: Object.fromEntries(await Promise.all(shown.map(async (card) => [card.id, await this.brandOf(card)] as const))),
    };
  }

  /** The brand a card is about: the brief it would start, the task it pauses, the plan it belongs to, or the chat that asked; "" for the whole workspace. */
  private async brandOf(card: Card): Promise<string> {
    Trace.tick(import.meta.url, "WorkspaceBoard.brandOf", { kind: card.action.kind });
    const action = card.action;
    if (action.kind === "start_task") return Brands.key(action.brief);
    if (action.kind === "reply_operator") return action.brand ?? "";
    if (action.kind === "answer_task") {
      const run = await this.store.getRun(action.run_id);
      return run ? Brands.key(run.brief) : "";
    }
    if (action.kind === "start_stage") {
      const plan = await this.store.plans.get(Scope.everything, action.plan_id);
      return plan ? Brands.key(plan.brief) : "";
    }
    return "";
  }

  private async card(run: ResearchRun): Promise<TaskCard> {
    Trace.tick(import.meta.url, "WorkspaceBoard.card");
    const { counts, error, status } = Runs.summary(run);
    const rows = run.packet ? [] : (await this.store.findings.list(run.id)).filter((row) => !row.retracted_at);
    const live = (kind: string, packed: number) => (run.packet ? packed : rows.filter((row) => row.kind === kind).length);
    const billed = (run.usage as { billed?: { total?: number } }).billed?.total ?? null;
    return {
      run_id: run.id,
      product_id: run.product_id,
      objective: String(run.contract?.objective ?? ""),
      status,
      error,
      sources: live("source", counts.sources),
      attributes: live("attribute", counts.attributes),
      measurements: live("measurement", counts.measurements),
      gaps: live("gap", counts.gaps),
      calls: (await this.store.listLlmCalls(run.id)).length,
      billed_usd: billed,
      question: status === "waiting" ? await this.tasks.question(run.id) : "",
      created_at: run.created_at,
    };
  }
}
