import type Database from "better-sqlite3";

import { Clock, Ids, type Judgement, type Scope, type SourceKind } from "../../domain/index.js";

import { Rows } from "./rows.js";
import { ScopeFilter } from "./scope-filter.js";
import { Trace } from "../../trace/index.js";

export class JudgementTable {
  constructor(private readonly db: Database.Database) {}

  list(scope: Scope, activeOnly = false): Judgement[] {
    Trace.line(import.meta.url, "JudgementTable.list", { scope, activeOnly });
    let sql = `SELECT * FROM research_judgements WHERE ${ScopeFilter.sql("workspace_id")}`;
    if (activeOnly) sql += " AND active = 1";
    sql += " ORDER BY created_at";
    const rows = this.db.prepare(sql).all(...ScopeFilter.args(scope)) as Array<Record<string, any>>;
    return rows.map((row) => ({
      id: row.id as string,
      workspace_id: row.workspace_id as string,
      kind: row.kind as string,
      text: row.text as string,
      rejects_kinds: Rows.json(row.rejects_kinds, []) as SourceKind[],
      active: Boolean(row.active),
      applied_count: row.applied_count as number,
      created_at: row.created_at as string,
    }));
  }

  add(workspaceId: string, input: { kind: string; text: string; rejects_kinds: SourceKind[] }): Judgement {
    Trace.line(import.meta.url, "JudgementTable.add", { workspaceId, input });
    const judgement: Judgement = {
      id: Ids.next(),
      workspace_id: workspaceId,
      kind: input.kind,
      text: input.text,
      rejects_kinds: [...input.rejects_kinds],
      active: true,
      applied_count: 0,
      created_at: Clock.nowIso(),
    };
    this.db
      .prepare(
        "INSERT INTO research_judgements (id, workspace_id, kind, text, rejects_kinds, active," +
          " applied_count, created_at) VALUES (?,?,?,?,?,?,?,?)",
      )
      .run(
        judgement.id,
        judgement.workspace_id,
        judgement.kind,
        judgement.text,
        JSON.stringify(judgement.rejects_kinds),
        1,
        0,
        judgement.created_at,
      );
    return judgement;
  }

  delete(scope: Scope, judgementId: string): boolean {
    Trace.line(import.meta.url, "JudgementTable.delete", { scope, judgementId });
    return (
      this.db
        .prepare(`DELETE FROM research_judgements WHERE id = ? AND ${ScopeFilter.sql("workspace_id")}`)
        .run(judgementId, ...ScopeFilter.args(scope)).changes > 0
    );
  }

  bump(judgementId: string, by = 1): void {
    Trace.line(import.meta.url, "JudgementTable.bump", { judgementId, by });
    this.db
      .prepare("UPDATE research_judgements SET applied_count = applied_count + ? WHERE id = ?")
      .run(by, judgementId);
  }
}
