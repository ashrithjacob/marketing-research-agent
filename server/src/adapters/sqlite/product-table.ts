import type Database from "better-sqlite3";

import { Clock, Ids, type Product, type Scope } from "../../domain/index.js";

import { ScopeFilter } from "./scope-filter.js";
import { Trace } from "../../trace/index.js";

const SELECT =
  "SELECT p.id, p.key, p.label, p.created_at," +
  " (SELECT COUNT(DISTINCT l.review_id) FROM research_run_reviews l JOIN research_runs r ON r.id = l.run_id" +
  `   WHERE l.product_id = p.id AND ${ScopeFilter.sql("r.workspace_id")}) AS review_count` +
  " FROM research_products p";

const IN_SCOPE =
  "EXISTS (SELECT 1 FROM research_runs r WHERE r.product_id = p.id" +
  ` AND ${ScopeFilter.sql("r.workspace_id")})`;

/** One row per product, found by the key its briefs reduce to; a scope sees only products it has runs of. */
export class ProductTable {
  constructor(private readonly db: Database.Database) {}

  ensure(key: string, label: string): string {
    Trace.line(import.meta.url, "ProductTable.ensure", { key, label });
    const now = Clock.nowIso();
    const row = this.db
      .prepare(
        "INSERT INTO research_products (id, key, label, created_at, updated_at) VALUES (?,?,?,?,?)" +
          " ON CONFLICT(key) DO UPDATE SET label = excluded.label, updated_at = excluded.updated_at" +
          " RETURNING id",
      )
      .get(Ids.next(), key, label, now, now) as { id: string };
    return row.id;
  }

  get(productId: string, scope: Scope): Product | null {
    Trace.line(import.meta.url, "ProductTable.get", { productId, scope });
    const args = ScopeFilter.args(scope);
    const row = this.db.prepare(`${SELECT} WHERE p.id = ? AND ${IN_SCOPE}`).get(...args, productId, ...args);
    return (row as Product | undefined) ?? null;
  }

  byKey(key: string, scope: Scope): Product | null {
    Trace.line(import.meta.url, "ProductTable.byKey", { key, scope });
    const args = ScopeFilter.args(scope);
    return (this.db.prepare(`${SELECT} WHERE p.key = ?`).get(...args, key) as Product | undefined) ?? null;
  }

  list(scope: Scope): Product[] {
    Trace.line(import.meta.url, "ProductTable.list", { scope });
    const args = ScopeFilter.args(scope);
    return this.db.prepare(`${SELECT} WHERE ${IN_SCOPE}`).all(...args, ...args) as Product[];
  }
}
