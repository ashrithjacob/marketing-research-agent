import { Briefs, FeedbackStrengths, SAVED_TASKS, SavedPlans, Scope, briefSchema, productTruthInputsSchema, type FeedbackBook, type Plan, type PlanBook, type PlanTask } from "../../domain/index.js";
import { ContractCheck } from "../../extract/index.js";
import { Trace } from "../../trace/index.js";

import { ApprovalNeeded, RunError } from "../errors.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

import type { CardDesk } from "./card-desk.js";

/** What may change in a plan before it is approved: its market, which tasks it keeps, and saved tasks it adds. */
export interface PlanChange {
  market?: string;
  drop?: readonly string[];
  keep?: readonly string[];
  add?: readonly string[];
  stop_when?: Readonly<Record<string, string>>;
}

/** Plans from Start to approval: drafted from the saved tasks, changed by toggles or by the operator, and approved only by the owner's button, which starts each kept task. */
export class PlanDesk {
  constructor(
    private readonly plans: PlanBook,
    private readonly tasks: TaskSupervisor,
    private readonly cards: CardDesk,
    private readonly feedback: FeedbackBook,
  ) {}

  /** A draft plan for a brief, with only the `keep` tasks selected when given. */
  async draft(body: unknown, workspaceId: string, keep: readonly string[] = []): Promise<Plan> {
    Trace.line(import.meta.url, "PlanDesk.draft", { workspaceId, keep });
    const unknown = keep.filter((key) => !SavedPlans.parts().includes(key));
    if (unknown.length > 0) throw new RunError(`no stage-1 part ${unknown.join(", ")}; the parts are ${SavedPlans.parts().join(", ")}`);
    const parsed = briefSchema.safeParse((body as { brief?: unknown } | null)?.brief);
    if (!parsed.success) throw new RunError("a plan needs a brief: { brief: { url } } or { brief: { product } }");
    const brief = Briefs.normalise(parsed.data);
    if (!brief.product && !brief.url) throw new RunError("brief.product or brief.url is required");
    return this.plans.create(workspaceId, brief, SavedPlans.tasks(brief, keep), SavedPlans.stages());
  }

  async revise(planId: string, scope: Scope, change: PlanChange): Promise<Plan> {
    Trace.line(import.meta.url, "PlanDesk.revise", { planId, change });
    const plan = await this.open(planId, scope);
    const brief = change.market === undefined ? plan.brief : { ...plan.brief, market: change.market };
    const unknown = [...(change.add ?? [])].filter((key) => !SAVED_TASKS[key]);
    if (unknown.length > 0) throw new RunError(`no saved task ${unknown.join(", ")}; the saved tasks are ${Object.keys(SAVED_TASKS).join(", ")}`);
    const auto = [...(change.drop ?? []), ...(change.keep ?? [])].filter((key) => plan.tasks.some((task) => task.key === key && task.auto));
    if (auto.length > 0) throw new RunError(`${auto.join(", ")} is kept or dropped by the plan itself, by what the other tasks need`);
    const added = (change.add ?? []).filter((key) => !plan.tasks.some((task) => task.key === key)).map((key) => SavedPlans.task(key, brief));
    const tasks = [...plan.tasks, ...added].map((task) => {
      const fresh = SavedPlans.task(task.key, brief);
      const stopWhen = (change.stop_when?.[task.key] ?? task.contract.stop_when ?? "").trim();
      return {
        ...fresh,
        contract: { ...fresh.contract, stop_when: stopWhen || undefined },
        selected: change.drop?.includes(task.key) ? false : change.keep?.includes(task.key) || change.add?.includes(task.key) ? true : task.selected,
      };
    });
    const saved = await this.plans.save({ ...plan, brief, tasks: SavedPlans.arrange(brief, tasks) });
    await this.feedback.record(plan.workspace_id, { verdict: "edited", target: FeedbackStrengths.target("contract", plan.id, { plan_id: plan.id }), text: "", diff: { ...change } });
    return saved;
  }

  /** A later stage of a draft plan ticked or not, with product truth's landed cost when given. Review mining builds on product truth, so ticking it ticks product truth, and dropping product truth drops it. */
  async setStage(planId: string, scope: Scope, stage: number, selected: boolean, cost: { landed_unit_cost?: number; currency?: string } = {}): Promise<Plan> {
    Trace.line(import.meta.url, "PlanDesk.setStage", { planId, stage, selected });
    const plan = await this.open(planId, scope);
    if (stage !== 2 && stage !== 3) throw new RunError("a plan's later stages are 2 (product truth) and 3 (review mining)");
    const stages = plan.stages.map((s) => {
      const on = s.stage === stage ? selected : stage === 3 && selected && s.stage === 2 ? true : stage === 2 && !selected && s.stage === 3 ? false : s.selected;
      const given = s.stage === 2 && cost.landed_unit_cost !== undefined ? { inputs: productTruthInputsSchema.parse({ landed_unit_cost: cost.landed_unit_cost, currency: cost.currency ?? "" }) } : {};
      return { ...s, ...given, selected: on };
    });
    return this.plans.save({ ...plan, stages });
  }

  /** The owner's approval: each kept task with nothing to wait for is started; a task that waits on another starts when that one ends (PlanRelease). */
  async approve(planId: string, scope: Scope): Promise<Plan> {
    Trace.line(import.meta.url, "PlanDesk.approve", { planId });
    const plan = await this.open(planId, scope);
    if (!plan.tasks.some((task) => task.selected && !task.auto)) throw new RunError("the plan keeps no task; keep at least one before approving");
    const tasks = [];
    for (const task of plan.tasks) tasks.push(task.selected && task.after.length === 0 ? await this.startTask(plan, task) : task);
    for (const task of tasks.filter((t) => t.selected && !t.auto)) {
      await this.feedback.record(plan.workspace_id, { verdict: "accept", target: FeedbackStrengths.target("contract", task.key, { plan_id: plan.id, run_id: task.run_id }), text: task.title });
    }
    return this.plans.save({ ...plan, tasks, status: "approved" });
  }

  /** One task of a plan started, past its contract check: as a run, or, when it would spend Apify money, as an approval card the owner presses first. */
  async startTask(plan: Plan, task: PlanTask): Promise<PlanTask> {
    Trace.line(import.meta.url, "PlanDesk.startTask", { planId: plan.id, key: task.key });
    try {
      const run = await this.tasks.start({ brief: plan.brief, contract: task.contract }, plan.workspace_id);
      return { ...task, run_id: run.id, error: "" };
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      if (!(error instanceof ApprovalNeeded)) return { ...task, error: error.message };
      await this.askApproval(plan, task);
      return { ...task, error: "waiting for your approval: it would spend Apify money" };
    }
  }

  private async askApproval(plan: Plan, task: PlanTask): Promise<void> {
    Trace.line(import.meta.url, "PlanDesk.askApproval", { planId: plan.id, key: task.key });
    const body = `${task.contract.objective}. ${ContractCheck.asksFirst(task.contract).join("; ")}; at most $${task.contract.budget.max_usd.toFixed(2)}.`;
    const action = { kind: "start_task" as const, brief: plan.brief, contract: task.contract, plan_id: plan.id, task_key: task.key };
    await this.cards.open(plan.workspace_id, { kind: "approval", title: `Approve ${task.title}?`, body, action });
  }

  private async open(planId: string, scope: Scope): Promise<Plan> {
    Trace.line(import.meta.url, "PlanDesk.open", { planId });
    const plan = await this.plans.get(scope, planId);
    if (!plan) throw new RunError(`no plan ${planId}`);
    if (plan.status !== "draft") throw new RunError(`plan ${planId} is already approved; Start a new plan to change the work`);
    return plan;
  }
}
