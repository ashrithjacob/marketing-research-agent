import { Clock, type PacketCheck } from "../../domain/index.js";

import { Rows } from "./rows.js";
import { RunLock } from "./run-lock.js";
import type { SqlDatabase } from "./sql-database.js";
import { Trace } from "../../trace/index.js";

export class PacketCheckLog {
  constructor(private readonly db: SqlDatabase) {}

  async add(runId: string, valid: boolean, problems: readonly string[]): Promise<PacketCheck> {
    Trace.line(import.meta.url, "PacketCheckLog.add", { runId, valid, problems });
    const created = Clock.nowIso();
    return this.db.transaction(async (tx) => {
      await RunLock.claim(tx, runId);
      const { seq } = (await tx.get<{ seq: number }>(
        "SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM research_packet_checks WHERE run_id = ?",
        [runId],
      ))!;
      const row = await tx.get<{ id: number }>(
        "INSERT INTO research_packet_checks (run_id, seq, valid, problems, created_at) VALUES (?,?,?,?,?) RETURNING id",
        [runId, seq, valid ? 1 : 0, JSON.stringify(problems), created],
      );
      return { id: row!.id, run_id: runId, seq, valid, problems: [...problems], created_at: created };
    });
  }

  async list(runId: string): Promise<PacketCheck[]> {
    Trace.line(import.meta.url, "PacketCheckLog.list", { runId });
    const rows = await this.db.all("SELECT * FROM research_packet_checks WHERE run_id = ? ORDER BY seq", [runId]);
    return rows.map((row) => ({
      id: row.id,
      run_id: row.run_id,
      seq: row.seq,
      valid: row.valid === 1,
      problems: Rows.json(row.problems, []) as string[],
      created_at: row.created_at,
    }));
  }
}
