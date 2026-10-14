import { Runs, Scope, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { TaskSupervisor } from "../task/task-supervisor.js";

/** What the operator's list_work reads: the brand's newest plans, its newest tasks with what they found, the tasks waiting on the owner, and whether Always on is on. */
export class WorkReport {
  constructor(
    private readonly store: ResearchStore,
    private readonly tasks: TaskSupervisor,
  ) {}

  async write(workspace: string): Promise<string> {
    Trace.line(import.meta.url, "WorkReport.write", { workspace });
    const scope = Scope.of(workspace);
    const plans = (await this.store.plans.list(scope, 3)).map((plan) => ({
      plan_id: plan.id,
      status: plan.status,
      brief: plan.brief,
      tasks: plan.tasks.map((task) => ({ key: task.key, title: task.title, kept: task.selected, stop_when: task.contract.stop_when ?? "", run_id: task.run_id, error: task.error })),
    }));
    const tasks = (await this.store.listRuns(scope, 50)).filter((run) => run.contract).slice(0, 10).map((run) => {
      const { status, error, counts } = Runs.summary(run);
      return { run_id: run.id, objective: String(run.contract?.objective ?? ""), status, error, sources: counts.sources, gaps: counts.gaps };
    });
    const waiting = await this.tasks.waiting(workspace);
    const always = await this.store.alwaysOn.get(workspace);
    const schedules = (await this.store.schedules.list(workspace)).map((s) => ({ id: s.id, task_key: s.task_key, every_days: s.every_days, brief: s.brief }));
    return JSON.stringify({ always_on: always.on, daily_cap_usd: always.daily_cap_usd, plans, tasks, waiting, schedules }, null, 1);
  }

}
