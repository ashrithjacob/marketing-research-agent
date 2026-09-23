import type Database from "better-sqlite3";

import { Clock, Ids, type Judgement, type SourceKind } from "../../domain/index.js";

import { Rows } from "./rows.js";

export class JudgementTable {
  constructor(private readonly db: Database.Database) {}

  list(activeOnly = false): Judgement[] {
    let sql = "SELECT * FROM research_judgements";
    if (activeOnly) sql += " WHERE active = 1";
    sql += " ORDER BY created_at";
    const rows = this.db.prepare(sql).all() as Array<Record<string, any>>;
    return rows.map((row) => ({
      id: row.id as string,
      kind: row.kind as string,
      text: row.text as string,
      rejects_kinds: Rows.json(row.rejects_kinds, []) as SourceKind[],
      active: Boolean(row.active),
      applied_count: row.applied_count as number,
      created_at: row.created_at as string,
    }));
  }

  add(input: { kind: string; text: string; rejects_kinds: SourceKind[] }): Judgement {
    const judgement: Judgement = {
      id: Ids.next(),
      kind: input.kind,
      text: input.text,
      rejects_kinds: [...input.rejects_kinds],
      active: true,
      applied_count: 0,
      created_at: Clock.nowIso(),
    };
    this.db
      .prepare(
        "INSERT INTO research_judgements (id, kind, text, rejects_kinds, active," +
          " applied_count, created_at) VALUES (?,?,?,?,?,?,?)",
      )
      .run(
        judgement.id,
        judgement.kind,
        judgement.text,
        JSON.stringify(judgement.rejects_kinds),
        1,
        0,
        judgement.created_at,
      );
    return judgement;
  }

  delete(judgementId: string): void {
    this.db.prepare("DELETE FROM research_judgements WHERE id = ?").run(judgementId);
  }

  bump(judgementId: string, by = 1): void {
    this.db
      .prepare("UPDATE research_judgements SET applied_count = applied_count + ? WHERE id = ?")
      .run(by, judgementId);
  }
}
