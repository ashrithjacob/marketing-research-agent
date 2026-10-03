
import { Clock, type RunEvent } from "../../domain/index.js";

import { Rows } from "./rows.js";
import type { SqlDatabase } from "./sql-database.js";
import { Trace } from "../../trace/index.js";

export class EventLog {
  constructor(private readonly db: SqlDatabase) {}

  async add(runId: string, kind: string, payload: Record<string, unknown>): Promise<RunEvent> {
    Trace.tick(import.meta.url, "EventLog.add", { kind });
    const now = Clock.nowIso();
    const row = await this.db.get<{ id: number }>(
      "INSERT INTO research_events (run_id, kind, payload, created_at) VALUES (?,?,?,?) RETURNING id",
      [runId, kind, JSON.stringify(payload), now],
    );
    return { id: row!.id, run_id: runId, kind, payload, created_at: now };
  }

  /** The id of the run's newest event, 0 when it has none: where a viewer that already has the run's state starts listening. */
  async lastId(runId: string): Promise<number> {
    Trace.line(import.meta.url, "EventLog.lastId", { runId });
    const row = await this.db.get<{ id: number | null }>("SELECT MAX(id) AS id FROM research_events WHERE run_id = ?", [runId]);
    return row?.id ?? 0;
  }

  async list(runId: string, afterId = 0): Promise<RunEvent[]> {
    Trace.line(import.meta.url, "EventLog.list", { runId, afterId });
    const rows = await this.db.all("SELECT * FROM research_events WHERE run_id = ? AND id > ? ORDER BY id", [runId, afterId]);
    return rows.map((row) => ({
      id: row.id as number,
      run_id: row.run_id as string,
      kind: row.kind as string,
      payload: Rows.json(row.payload, {}) as Record<string, unknown>,
      created_at: row.created_at as string,
    }));
  }
}
