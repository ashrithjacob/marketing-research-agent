import { Briefs, SAVED_TASKS, SavedPlans, Scope, briefSchema } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ApprovalNeeded, RunError } from "../errors.js";
import type { PlanDesk } from "../operator/plan-desk.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

/** The operator's create_task (spec §7.2): with Always on and within the limits, a saved task that needs no other task and no Apify starts at once; otherwise it becomes a plan the owner approves. Workers cannot create tasks; only the operator and the owner can. */
export class TaskCreation {
  static readonly ALONE: ReadonlySet<string> = new Set(["product_facts", "category_numbers"]);

  constructor(
    private readonly tasks: TaskSupervisor,
    private readonly plans: PlanDesk,
  ) {}

  async create(workspaceId: string, key: string, rawBrief: unknown): Promise<string> {
    Trace.line(import.meta.url, "TaskCreation.create", { workspaceId, key });
    if (!SAVED_TASKS[key]) throw new RunError(`no saved task '${key}'; the saved tasks are ${Object.keys(SAVED_TASKS).join(", ")}`);
    const parsed = briefSchema.safeParse(rawBrief);
    if (!parsed.success) throw new RunError("a task needs a brief: { url } or { product }, and a market if the owner named one");
    const brief = Briefs.normalise(parsed.data);
    const blocks = await this.tasks.limits.blocks(workspaceId);
    if (blocks.length > 0 || !TaskCreation.ALONE.has(key)) {
      const plan = await this.plans.draft({ brief }, workspaceId);
      const kept = await this.plans.revise(plan.id, Scope.of(workspaceId), { drop: plan.tasks.filter((t) => t.key !== key && !t.auto).map((t) => t.key) });
      const why = blocks.length > 0 ? blocks.join("; ") : `${SAVED_TASKS[key]!.title} needs the champion or Apify, which the owner approves`;
      return `Drafted plan ${kept.id} for the owner to approve, because ${why}.`;
    }
    try {
      const run = await this.tasks.start({ brief, contract: SavedPlans.task(key, brief).contract }, workspaceId);
      return `Started ${SAVED_TASKS[key]!.title} as task ${run.id}.`;
    } catch (error) {
      if (error instanceof ApprovalNeeded) throw new RunError(`${error.message}; draft a plan for the owner instead`);
      throw error;
    }
  }
}
