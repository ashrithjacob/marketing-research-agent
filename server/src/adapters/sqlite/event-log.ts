import type Database from "better-sqlite3";

import { Clock, type RunEvent } from "../../domain/index.js";

import { Rows } from "./rows.js";
import { Trace } from "../../trace/index.js";

export class EventLog {
  constructor(private readonly db: Database.Database) {}

  add(runId: string, kind: string, payload: Record<string, unknown>): RunEvent {
    Trace.tick(import.meta.url, "EventLog.add", { kind });
    const now = Clock.nowIso();
    const info = this.db
      .prepare("INSERT INTO research_events (run_id, kind, payload, created_at) VALUES (?,?,?,?)")
      .run(runId, kind, JSON.stringify(payload), now);
    return { id: Number(info.lastInsertRowid), run_id: runId, kind, payload, created_at: now };
  }

  list(runId: string, afterId = 0): RunEvent[] {
    Trace.line(import.meta.url, "EventLog.list", { runId, afterId });
    const rows = this.db
      .prepare("SELECT * FROM research_events WHERE run_id = ? AND id > ? ORDER BY id")
      .all(runId, afterId) as Array<Record<string, any>>;
    return rows.map((row) => ({
      id: row.id as number,
      run_id: row.run_id as string,
      kind: row.kind as string,
      payload: Rows.json(row.payload, {}) as Record<string, unknown>,
      created_at: row.created_at as string,
    }));
  }
}
