import type Database from "better-sqlite3";

import type { LedgerExcerpt, ReviewLedger } from "../../domain/index.js";

export class SqliteReviewLedger implements ReviewLedger {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS review_ledger (
    band_key   TEXT NOT NULL,
    locator    TEXT NOT NULL,
    excerpt    TEXT NOT NULL,
    run_id     TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (band_key, locator)
);
`;

  constructor(private readonly db: Database.Database) {}

  cached(bandKey: string, limit: number): LedgerExcerpt[] {
    const rows = this.db
      .prepare("SELECT excerpt FROM review_ledger WHERE band_key = ? ORDER BY rowid DESC LIMIT ?")
      .all(bandKey, limit) as Array<{ excerpt: string }>;
    return rows.map((row) => JSON.parse(row.excerpt) as LedgerExcerpt);
  }

  record(bandKey: string, runId: string, excerpts: readonly LedgerExcerpt[]): void {
    if (excerpts.length === 0) return;
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO review_ledger (band_key, locator, excerpt, run_id, created_at) " +
        "VALUES (?, ?, ?, ?, ?)",
    );
    const at = new Date().toISOString();
    this.db.transaction(() => {
      for (const excerpt of excerpts) {
        if (!excerpt.locator) continue;
        insert.run(bandKey, excerpt.locator, JSON.stringify(excerpt), runId, at);
      }
    })();
  }
}
