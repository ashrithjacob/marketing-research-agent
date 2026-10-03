
import { Clock, Ids, type Judgement, type Scope, type SourceKind } from "../../domain/index.js";

import { Rows } from "./rows.js";
import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";
import { Trace } from "../../trace/index.js";

export class JudgementTable {
  constructor(private readonly db: SqlDatabase) {}

  async list(scope: Scope, activeOnly = false): Promise<Judgement[]> {
    Trace.line(import.meta.url, "JudgementTable.list", { scope, activeOnly });
    let sql = `SELECT * FROM research_judgements WHERE ${ScopeFilter.sql("workspace_id")}`;
    if (activeOnly) sql += " AND active = 1";
    sql += " ORDER BY created_at";
    const rows = await this.db.all(sql, ScopeFilter.args(scope));
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

  async add(workspaceId: string, input: { kind: string; text: string; rejects_kinds: SourceKind[] }): Promise<Judgement> {
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
    await this.db.run(
      "INSERT INTO research_judgements (id, workspace_id, kind, text, rejects_kinds, active," +
        " applied_count, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [judgement.id, judgement.workspace_id, judgement.kind, judgement.text, JSON.stringify(judgement.rejects_kinds), 1, 0, judgement.created_at],
    );
    return judgement;
  }

  async delete(scope: Scope, judgementId: string): Promise<boolean> {
    Trace.line(import.meta.url, "JudgementTable.delete", { scope, judgementId });
    const changed = await this.db.run(
      `DELETE FROM research_judgements WHERE id = ? AND ${ScopeFilter.sql("workspace_id")}`,
      [judgementId, ...ScopeFilter.args(scope)],
    );
    return changed > 0;
  }

  async bump(judgementId: string, by = 1): Promise<void> {
    Trace.line(import.meta.url, "JudgementTable.bump", { judgementId, by });
    await this.db.run("UPDATE research_judgements SET applied_count = applied_count + ? WHERE id = ?", [by, judgementId]);
  }
}
