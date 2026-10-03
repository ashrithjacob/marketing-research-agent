import {
  Clock,
  Findings,
  type Finding,
  type FindingDraft,
  type FindingKind,
  type FindingLedger,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { Rows } from "./rows.js";
import { RunLock } from "./run-lock.js";
import type { SqlDatabase } from "./sql-database.js";

/** The run ledger: one row per finding, numbered per run, appended as the agent works. */
export class FindingTable implements FindingLedger {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_findings (
    run_id        TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    seq           INTEGER NOT NULL,
    id            TEXT NOT NULL,
    kind          TEXT NOT NULL,
    entity        TEXT NOT NULL DEFAULT '',
    agent_id      TEXT NOT NULL DEFAULT '',
    source_id     TEXT NOT NULL DEFAULT '',
    payload       TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL,
    retracted_at  TEXT NOT NULL DEFAULT '',
    retracted_why TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (run_id, seq),
    UNIQUE (run_id, id)
);
`;

  constructor(private readonly db: SqlDatabase) {}

  async append(draft: FindingDraft): Promise<Finding> {
    Trace.line(import.meta.url, "FindingTable.append", { runId: draft.run_id, kind: draft.kind });
    return this.db.transaction(async (tx): Promise<Finding> => {
      await RunLock.claim(tx, draft.run_id);
      const { next } = (await tx.get<{ next: number }>(
        "SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM research_findings WHERE run_id = ?",
        [draft.run_id],
      ))!;
      const row: Finding = {
        ...draft,
        seq: next,
        id: Findings.rowId(draft.kind, next),
        created_at: Clock.nowIso(),
        retracted_at: "",
        retracted_why: "",
      };
      await tx.run(
        "INSERT INTO research_findings (run_id, seq, id, kind, entity, agent_id, source_id, payload, created_at)" +
          " VALUES (?,?,?,?,?,?,?,?,?)",
        [row.run_id, row.seq, row.id, row.kind, row.entity, row.agent_id, row.source_id, JSON.stringify(row.payload), row.created_at],
      );
      return row;
    });
  }

  async retract(runId: string, id: string, why: string): Promise<Finding | null> {
    Trace.line(import.meta.url, "FindingTable.retract", { runId, id, why });
    const changed = await this.db.run(
      "UPDATE research_findings SET retracted_at = ?, retracted_why = ? WHERE run_id = ? AND id = ? AND retracted_at = ''",
      [Clock.nowIso(), why, runId, id],
    );
    if (changed === 0) return null;
    return (await this.list(runId)).find((row) => row.id === id) ?? null;
  }

  async list(runId: string): Promise<Finding[]> {
    Trace.line(import.meta.url, "FindingTable.list", { runId });
    const rows = await this.db.all("SELECT * FROM research_findings WHERE run_id = ? ORDER BY seq", [runId]);
    return rows.map((row) => ({
      run_id: row.run_id as string,
      seq: row.seq as number,
      id: row.id as string,
      kind: row.kind as FindingKind,
      entity: row.entity as string,
      agent_id: row.agent_id as string,
      source_id: row.source_id as string,
      payload: Rows.json(row.payload, {}) as Record<string, unknown>,
      created_at: row.created_at as string,
      retracted_at: row.retracted_at as string,
      retracted_why: row.retracted_why as string,
    }));
  }
}
