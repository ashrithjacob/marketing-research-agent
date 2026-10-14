import { Findings, RunStatuses, Scope, TERMINAL_STATUSES, type Plan, type PlanBook, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { TaskEvents } from "../task/task-events.js";

import type { PlanDesk } from "./plan-desk.js";

/** Starts a plan's waiting tasks when the task they wait on ends: with its champion's reference as their input when it delivered, with why not when it did not. At startup it does the same for any it missed. */
export class PlanRelease {
  constructor(
    private readonly store: ResearchStore,
    private readonly plans: PlanBook,
    private readonly desk: PlanDesk,
    events: TaskEvents,
  ) {
    Trace.line(import.meta.url, "PlanRelease.constructor");
    events.on((runId) => this.release(runId).then(() => undefined));
  }

  async recover(): Promise<number> {
    Trace.line(import.meta.url, "PlanRelease.recover");
    let released = 0;
    for (const plan of await this.plans.list(Scope.everything, 50)) {
      if (plan.status !== "approved") continue;
      for (const task of plan.tasks) {
        if (!task.run_id || !TERMINAL_STATUSES.has((await this.store.getRun(task.run_id))?.status ?? "")) continue;
        if (plan.tasks.some((t) => t.after.includes(task.key) && t.selected && !t.run_id && !t.error)) released += await this.release(task.run_id);
      }
    }
    return released;
  }

  private async release(runId: string): Promise<number> {
    Trace.line(import.meta.url, "PlanRelease.release", { runId });
    const plan = (await this.plans.list(Scope.everything, 50)).find((p) => p.tasks.some((t) => t.run_id === runId));
    const done = plan?.tasks.find((t) => t.run_id === runId);
    if (!plan || !done) return 0;
    const waiting = plan.tasks.filter((t) => t.selected && t.after.includes(done.key) && !t.run_id && !t.error);
    if (waiting.length === 0) return 0;
    const inputs = await this.inputs(runId);
    const status = (await this.store.getRun(runId))?.status ?? "";
    const tasks = [];
    for (const task of plan.tasks) {
      if (!waiting.includes(task)) tasks.push(task);
      else if (inputs.length === 0) tasks.push({ ...task, error: `${done.title} ended ${status} without what this task needs from it` });
      else tasks.push(await this.desk.startTask(plan, { ...task, contract: { ...task.contract, inputs: { ...task.contract.inputs, finding_ids: inputs } } }));
    }
    await this.plans.save({ ...plan, tasks } satisfies Plan);
    return waiting.length;
  }

  /** What a finished task hands on: a delivered champion's reference row and its gaps (such as a ranking it could not have), which qualify the reference, each named by run and row id. */
  private async inputs(runId: string): Promise<string[]> {
    Trace.line(import.meta.url, "PlanRelease.inputs", { runId });
    const run = await this.store.getRun(runId);
    if (!run || !RunStatuses.delivered(run.status)) return [];
    const rows = Findings.live(await this.store.findings.list(runId));
    const reference = rows.find((row) => row.kind === "competitor_reference");
    if (!reference) return [];
    return [reference, ...rows.filter((row) => row.kind === "gap")].map((row) => `${runId}/${row.id}`);
  }
}
