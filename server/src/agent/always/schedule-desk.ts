import { Briefs, SAVED_TASKS, briefSchema, type ResearchStore, type Schedule } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";

/** The owner's cadences (spec §7.3): a saved task to run again every so many days for a brief, read by the schedule watcher while Always on is on. */
export class ScheduleDesk {
  constructor(private readonly store: ResearchStore) {}

  async add(workspaceId: string, key: string, everyDays: number, rawBrief: unknown): Promise<Schedule> {
    Trace.line(import.meta.url, "ScheduleDesk.add", { workspaceId, key, everyDays });
    const brief = briefSchema.safeParse(rawBrief);
    if (!SAVED_TASKS[key]) throw new RunError(`no saved task '${key}'; the saved tasks are ${Object.keys(SAVED_TASKS).join(", ")}`);
    if (!brief.success || !(brief.data.url || brief.data.product)) throw new RunError("a schedule needs a brief: { url } or { product }");
    if (!(Number.isFinite(everyDays) && everyDays >= 1)) throw new RunError("a schedule repeats every whole number of days, at least 1");
    return this.store.schedules.add(workspaceId, Briefs.normalise(brief.data), key, Math.round(everyDays));
  }

  list(workspaceId: string): Promise<Schedule[]> {
    Trace.line(import.meta.url, "ScheduleDesk.list", { workspaceId });
    return this.store.schedules.list(workspaceId);
  }

  async remove(workspaceId: string, scheduleId: string): Promise<void> {
    Trace.line(import.meta.url, "ScheduleDesk.remove", { workspaceId, scheduleId });
    if (!(await this.store.schedules.remove(workspaceId, scheduleId))) throw new RunError(`no schedule ${scheduleId}`);
  }
}
