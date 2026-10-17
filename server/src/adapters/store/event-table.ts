import type { EventLog, RunEvent } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

export class EventTable implements EventLog {
  constructor(private readonly db: SqlDatabase) {}

  async add(runId: string, kind: string, payload: Record<string, unknown>): Promise<RunEvent> {
    Trace.tick(import.meta.url, "EventTable.add", { kind });
    return (await this.db.get<RunEvent>(
      "INSERT INTO run_events (run_id, kind, payload) VALUES (?,?,?) RETURNING *",
      [runId, kind, JSON.stringify(payload)],
    ))!;
  }

  async list(runId: string, afterId = 0): Promise<RunEvent[]> {
    Trace.line(import.meta.url, "EventTable.list", { runId, afterId });
    return this.db.all<RunEvent>("SELECT * FROM run_events WHERE run_id = ? AND id > ? ORDER BY id", [runId, afterId]);
  }
}
