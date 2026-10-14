import type { Brief } from "./brief.js";
import { Trace } from "../trace/index.js";

/** Whether a brand's work may start without the owner clicking, and what it may spend in a day (spec §7.2). Off by default; on needs a cap. */
export interface AlwaysOn {
  workspace_id: string;
  on: boolean;
  daily_cap_usd: number | null;
}

export interface AlwaysOnBook {
  get(workspaceId: string): Promise<AlwaysOn>;
  set(workspaceId: string, on: boolean, dailyCapUsd: number | null): Promise<AlwaysOn>;
  /** The workspaces whose Always on is on. */
  on(): Promise<string[]>;
}

/** The owner's cadence for one saved task: run it again every so many days for this brief (spec §7.3, the schedule watcher). */
export interface Schedule {
  id: string;
  workspace_id: string;
  brief: Brief;
  task_key: string;
  every_days: number;
  last_due_at: string;
  created_at: string;
}

export interface ScheduleBook {
  add(workspaceId: string, brief: Brief, taskKey: string, everyDays: number): Promise<Schedule>;
  list(workspaceId: string): Promise<Schedule[]>;
  remove(workspaceId: string, scheduleId: string): Promise<boolean>;
  /** Marks a schedule signalled for the period that came due at `dueAt`. */
  signalled(scheduleId: string, dueAt: string): Promise<void>;
}

/** When a schedule is next due: `every_days` after it was last due, or after it was made. */
export class Schedules {
  static nextDue(schedule: Schedule): number {
    Trace.line(import.meta.url, "Schedules.nextDue", { id: schedule.id });
    return Date.parse(schedule.last_due_at || schedule.created_at) + schedule.every_days * 86_400_000;
  }
}
