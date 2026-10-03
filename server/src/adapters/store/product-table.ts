
import { Clock, Ids, type Product, type Scope } from "../../domain/index.js";

import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";
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
  constructor(private readonly db: SqlDatabase) {}

  async ensure(key: string, label: string): Promise<string> {
    Trace.line(import.meta.url, "ProductTable.ensure", { key, label });
    const now = Clock.nowIso();
    const row = await this.db.get<{ id: string }>(
      "INSERT INTO research_products (id, key, label, created_at, updated_at) VALUES (?,?,?,?,?)" +
        " ON CONFLICT(key) DO UPDATE SET label = excluded.label, updated_at = excluded.updated_at" +
        " RETURNING id",
      [Ids.next(), key, label, now, now],
    );
    return row!.id;
  }

  async get(productId: string, scope: Scope): Promise<Product | null> {
    Trace.line(import.meta.url, "ProductTable.get", { productId, scope });
    const args = ScopeFilter.args(scope);
    return this.db.get<Product>(`${SELECT} WHERE p.id = ? AND ${IN_SCOPE}`, [...args, productId, ...args]);
  }

  async byKey(key: string, scope: Scope): Promise<Product | null> {
    Trace.line(import.meta.url, "ProductTable.byKey", { key, scope });
    return this.db.get<Product>(`${SELECT} WHERE p.key = ?`, [...ScopeFilter.args(scope), key]);
  }

  async list(scope: Scope): Promise<Product[]> {
    Trace.line(import.meta.url, "ProductTable.list", { scope });
    const args = ScopeFilter.args(scope);
    return this.db.all<Product>(`${SELECT} WHERE ${IN_SCOPE}`, [...args, ...args]);
  }
}
