import type Database from "better-sqlite3";

import { Clock, type PacketCheck } from "../../domain/index.js";

import { Rows } from "./rows.js";

export class PacketCheckLog {
  constructor(private readonly db: Database.Database) {}

  add(runId: string, valid: boolean, problems: readonly string[]): PacketCheck {
    const created = Clock.nowIso();
    const seq = this.nextSeq(runId);
    const info = this.db
      .prepare(
        "INSERT INTO research_packet_checks (run_id, seq, valid, problems, created_at)" +
          " VALUES (?,?,?,?,?)",
      )
      .run(runId, seq, valid ? 1 : 0, JSON.stringify(problems), created);
    return {
      id: Number(info.lastInsertRowid),
      run_id: runId,
      seq,
      valid,
      problems: [...problems],
      created_at: created,
    };
  }

  list(runId: string): PacketCheck[] {
    const rows = this.db
      .prepare("SELECT * FROM research_packet_checks WHERE run_id = ? ORDER BY seq")
      .all(runId) as Array<Record<string, any>>;
    return rows.map((row) => ({
      id: row.id,
      run_id: row.run_id,
      seq: row.seq,
      valid: row.valid === 1,
      problems: Rows.json(row.problems, []) as string[],
      created_at: row.created_at,
    }));
  }

  private nextSeq(runId: string): number {
    const row = this.db
      .prepare("SELECT MAX(seq) AS seq FROM research_packet_checks WHERE run_id = ?")
      .get(runId) as { seq: number | null };
    return (row.seq ?? 0) + 1;
  }
}
