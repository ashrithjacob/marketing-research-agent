import { Schedules, type ResearchStore, type Schedule } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { Watch } from "./watchers.js";

/** The owner's cadences (spec §7.3, `schedule`): each schedule past its due time is signalled once, then looked at again when the next is due, or in a day. */
export class ScheduleWatch implements Watch {
  readonly kind = "schedule";
  static readonly DAY_MS = 86_400_000;

  constructor(
    private readonly store: ResearchStore,
    private readonly signal: (workspaceId: string, schedule: Schedule, dueAt: string) => Promise<void>,
  ) {}

  async check(workspaceId: string, now: number): Promise<number> {
    Trace.line(import.meta.url, "ScheduleWatch.check", { workspaceId });
    for (const schedule of (await this.store.schedules.list(workspaceId)).filter((s) => Schedules.nextDue(s) <= now)) {
      const dueAt = new Date(now).toISOString();
      await this.signal(workspaceId, schedule, dueAt);
      await this.store.schedules.signalled(schedule.id, dueAt);
    }
    const next = (await this.store.schedules.list(workspaceId)).map((s) => Schedules.nextDue(s));
    return Math.min(now + ScheduleWatch.DAY_MS, ...next);
  }
}
