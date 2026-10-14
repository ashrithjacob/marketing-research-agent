import { Briefs, SAVED_TASKS, SavedPlans, Scope, briefSchema, type Plan, type PlanBook } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

/** What may change in a plan before it is approved: its market, which tasks it keeps, and saved tasks it adds. */
export interface PlanChange {
  market?: string;
  drop?: readonly string[];
  keep?: readonly string[];
  add?: readonly string[];
}

/** Plans from Start to approval: drafted from the saved tasks, changed by toggles or by the operator, and approved only by the owner's button, which starts each kept task. */
export class PlanDesk {
  constructor(
    private readonly plans: PlanBook,
    private readonly tasks: TaskSupervisor,
  ) {}

  async draft(body: unknown, workspaceId: string): Promise<Plan> {
    Trace.line(import.meta.url, "PlanDesk.draft", { workspaceId });
    const parsed = briefSchema.safeParse((body as { brief?: unknown } | null)?.brief);
    if (!parsed.success) throw new RunError("a plan needs a brief: { brief: { url } } or { brief: { product } }");
    const brief = Briefs.normalise(parsed.data);
    if (!brief.product && !brief.url) throw new RunError("brief.product or brief.url is required");
    return this.plans.create(workspaceId, brief, SavedPlans.tasks(brief));
  }

  async revise(planId: string, scope: Scope, change: PlanChange): Promise<Plan> {
    Trace.line(import.meta.url, "PlanDesk.revise", { planId, change });
    const plan = await this.open(planId, scope);
    const brief = change.market === undefined ? plan.brief : { ...plan.brief, market: change.market };
    const unknown = [...(change.add ?? [])].filter((key) => !SAVED_TASKS[key]);
    if (unknown.length > 0) throw new RunError(`no saved task ${unknown.join(", ")}; the saved tasks are ${Object.keys(SAVED_TASKS).join(", ")}`);
    const added = (change.add ?? []).filter((key) => !plan.tasks.some((task) => task.key === key)).map((key) => SavedPlans.task(key, brief));
    const tasks = [...plan.tasks, ...added].map((task) => ({
      ...SavedPlans.task(task.key, brief),
      selected: change.drop?.includes(task.key) ? false : change.keep?.includes(task.key) || change.add?.includes(task.key) ? true : task.selected,
    }));
    return this.plans.save({ ...plan, brief, tasks });
  }

  /** The owner's approval: each kept task is checked and started as a durable task; a task refused is kept on the plan with why. */
  async approve(planId: string, scope: Scope): Promise<Plan> {
    Trace.line(import.meta.url, "PlanDesk.approve", { planId });
    const plan = await this.open(planId, scope);
    if (!plan.tasks.some((task) => task.selected)) throw new RunError("the plan keeps no task; keep at least one before approving");
    const tasks = [];
    for (const task of plan.tasks) {
      if (!task.selected) {
        tasks.push(task);
        continue;
      }
      try {
        const run = await this.tasks.start({ brief: plan.brief, contract: task.contract }, plan.workspace_id);
        tasks.push({ ...task, run_id: run.id });
      } catch (error) {
        if (!(error instanceof RunError)) throw error;
        tasks.push({ ...task, error: error.message });
      }
    }
    return this.plans.save({ ...plan, tasks, status: "approved" });
  }

  private async open(planId: string, scope: Scope): Promise<Plan> {
    Trace.line(import.meta.url, "PlanDesk.open", { planId });
    const plan = await this.plans.get(scope, planId);
    if (!plan) throw new RunError(`no plan ${planId}`);
    if (plan.status !== "draft") throw new RunError(`plan ${planId} is already approved; Start a new plan to change the work`);
    return plan;
  }
}
