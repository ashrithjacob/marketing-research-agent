import { Clock, Ids, type Card, type CardBook, type CardDraft, type CardStatus, type Scope } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";

type CardRow = Omit<Card, "action"> & { action: string };

/** Cards, one row each, with the action their resolution triggers as JSON. A card is resolved once; a second resolution finds it closed. */
export class CardTable implements CardBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_cards (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    kind         TEXT NOT NULL,
    status       TEXT NOT NULL,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    action       TEXT NOT NULL,
    answer       TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    resolved_at  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS research_cards_workspace ON research_cards(workspace_id, created_at);
`;

  constructor(private readonly db: SqlDatabase) {}

  async create(workspaceId: string, draft: CardDraft): Promise<Card> {
    Trace.line(import.meta.url, "CardTable.create", { workspaceId, kind: draft.kind });
    const { kind, title, body, action } = draft;
    const card: Card = { id: Ids.next(), workspace_id: workspaceId, kind, status: "open", title, body, action, answer: "", created_at: Clock.nowIso(), resolved_at: "" };
    await this.db.run(
      "INSERT INTO research_cards (id, workspace_id, kind, status, title, body, action, answer, created_at, resolved_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [card.id, card.workspace_id, card.kind, card.status, card.title, card.body, JSON.stringify(card.action), "", card.created_at, ""],
    );
    return card;
  }

  async get(scope: Scope, cardId: string): Promise<Card | null> {
    Trace.line(import.meta.url, "CardTable.get", { cardId });
    const row = await this.db.get<CardRow>(`SELECT * FROM research_cards WHERE id = ? AND ${ScopeFilter.sql("workspace_id")}`, [cardId, ...ScopeFilter.args(scope)]);
    return row ? CardTable.card(row) : null;
  }

  async list(scope: Scope, limit: number): Promise<Card[]> {
    Trace.line(import.meta.url, "CardTable.list", { limit });
    const rows = await this.db.all<CardRow>(
      `SELECT * FROM research_cards WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC LIMIT ?`,
      [...ScopeFilter.args(scope), limit],
    );
    return rows.map(CardTable.card);
  }

  async resolve(cardId: string, status: Exclude<CardStatus, "open">, answer: string): Promise<Card | null> {
    Trace.line(import.meta.url, "CardTable.resolve", { cardId, status });
    const now = Clock.nowIso();
    await this.db.run("UPDATE research_cards SET status = ?, answer = ?, resolved_at = ? WHERE id = ? AND status = 'open'", [status, answer, now, cardId]);
    const row = await this.db.get<CardRow>("SELECT * FROM research_cards WHERE id = ?", [cardId]);
    return row && row.resolved_at === now && row.status === status ? CardTable.card(row) : null;
  }

  private static card(row: CardRow): Card {
    Trace.tick(import.meta.url, "CardTable.card");
    return { ...row, action: JSON.parse(row.action) as Card["action"] };
  }
}
