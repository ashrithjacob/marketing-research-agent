import type Database from "better-sqlite3";

import { Clock, Ids, type Product } from "../../domain/index.js";

const SELECT =
  "SELECT p.id, p.key, p.label, p.created_at," +
  " (SELECT COUNT(DISTINCT review_id) FROM research_run_reviews l WHERE l.product_id = p.id)" +
  " AS review_count FROM research_products p";

/** One row per product, found by the key its briefs reduce to. */
export class ProductTable {
  constructor(private readonly db: Database.Database) {}

  ensure(key: string, label: string): string {
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

  get(productId: string): Product | null {
    return (this.db.prepare(`${SELECT} WHERE p.id = ?`).get(productId) as Product | undefined) ?? null;
  }

  byKey(key: string): Product | null {
    return (this.db.prepare(`${SELECT} WHERE p.key = ?`).get(key) as Product | undefined) ?? null;
  }

  list(): Product[] {
    return this.db.prepare(SELECT).all() as Product[];
  }
}
