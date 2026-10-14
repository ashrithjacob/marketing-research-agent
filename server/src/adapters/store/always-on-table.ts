import { Clock, Ids, type AlwaysOn, type AlwaysOnBook, type Brief, type Schedule, type ScheduleBook } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

type ScheduleRow = Omit<Schedule, "brief"> & { brief: string };

/** The Always on switch and daily cap, two columns of `research_workspaces` (added by migration), and the owner's schedules. */
export class AlwaysOnTable implements AlwaysOnBook, ScheduleBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_schedules (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    brief        TEXT NOT NULL,
    task_key     TEXT NOT NULL,
    every_days   INTEGER NOT NULL,
    last_due_at  TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL
);
`;

  constructor(private readonly db: SqlDatabase) {}

  async get(workspaceId: string): Promise<AlwaysOn> {
    Trace.line(import.meta.url, "AlwaysOnTable.get", { workspaceId });
    const row = await this.db.get<{ always_on: number; daily_cap_usd: number | null }>("SELECT always_on, daily_cap_usd FROM research_workspaces WHERE id = ?", [workspaceId]);
    return { workspace_id: workspaceId, on: row?.always_on === 1, daily_cap_usd: row?.daily_cap_usd ?? null };
  }

  async set(workspaceId: string, on: boolean, dailyCapUsd: number | null): Promise<AlwaysOn> {
    Trace.line(import.meta.url, "AlwaysOnTable.set", { workspaceId, on, dailyCapUsd });
    await this.db.run(
      "INSERT INTO research_workspaces (id, name, created_at, always_on, daily_cap_usd) VALUES (?,?,?,?,?)" +
        " ON CONFLICT(id) DO UPDATE SET always_on = excluded.always_on, daily_cap_usd = excluded.daily_cap_usd",
      [workspaceId, workspaceId, Clock.nowIso(), on ? 1 : 0, dailyCapUsd],
    );
    return this.get(workspaceId);
  }

  async on(): Promise<string[]> {
    Trace.line(import.meta.url, "AlwaysOnTable.on");
    return (await this.db.all<{ id: string }>("SELECT id FROM research_workspaces WHERE always_on = 1")).map((row) => row.id);
  }

  async add(workspaceId: string, brief: Brief, taskKey: string, everyDays: number): Promise<Schedule> {
    Trace.line(import.meta.url, "AlwaysOnTable.add", { workspaceId, taskKey, everyDays });
    const schedule: Schedule = { id: Ids.next(), workspace_id: workspaceId, brief, task_key: taskKey, every_days: everyDays, last_due_at: "", created_at: Clock.nowIso() };
    await this.db.run("INSERT INTO research_schedules (id, workspace_id, brief, task_key, every_days, last_due_at, created_at) VALUES (?,?,?,?,?,?,?)", [
      schedule.id, workspaceId, JSON.stringify(brief), taskKey, everyDays, "", schedule.created_at,
    ]);
    return schedule;
  }

  async list(workspaceId: string): Promise<Schedule[]> {
    Trace.line(import.meta.url, "AlwaysOnTable.list", { workspaceId });
    const rows = await this.db.all<ScheduleRow>("SELECT * FROM research_schedules WHERE workspace_id = ? ORDER BY created_at", [workspaceId]);
    return rows.map((row) => ({ ...row, brief: JSON.parse(row.brief) as Brief }));
  }

  async remove(workspaceId: string, scheduleId: string): Promise<boolean> {
    Trace.line(import.meta.url, "AlwaysOnTable.remove", { workspaceId, scheduleId });
    const before = (await this.list(workspaceId)).length;
    await this.db.run("DELETE FROM research_schedules WHERE id = ? AND workspace_id = ?", [scheduleId, workspaceId]);
    return (await this.list(workspaceId)).length < before;
  }

  async signalled(scheduleId: string, dueAt: string): Promise<void> {
    Trace.line(import.meta.url, "AlwaysOnTable.signalled", { scheduleId, dueAt });
    await this.db.run("UPDATE research_schedules SET last_due_at = ? WHERE id = ?", [dueAt, scheduleId]);
  }
}
