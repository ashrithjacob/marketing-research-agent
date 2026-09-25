import type Database from "better-sqlite3";

import {
  Clock,
  type LedgerPull,
  type ReviewLedgerSnapshot,
  type StoredRunReview,
} from "../../domain/index.js";

/** The review corpus: each real review stored once, linked to every run that pulled it. */
export class ReviewTable {
  constructor(private readonly db: Database.Database) {}

  save(runId: string, ledger: ReviewLedgerSnapshot): number {
    const pulls = new Map<string, LedgerPull>(ledger.pulls.map((pull) => [pull.handle, pull]));
    const now = Clock.nowIso();
    const upsert = this.db.prepare(
      "INSERT INTO research_reviews (platform, review_key, listing, star, title, text, posted_at," +
        " verified, locator, first_seen_at, last_seen_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)" +
        " ON CONFLICT(platform, review_key) DO UPDATE SET last_seen_at = excluded.last_seen_at" +
        " RETURNING id",
    );
    const link = this.db.prepare(
      "INSERT OR REPLACE INTO research_run_reviews (run_id, review_id, ref, target_id, source_id," +
        " band_requested) VALUES (?,?,?,?,?,?)",
    );
    const write = this.db.transaction(() => {
      for (const review of ledger.reviews) {
        const pull = pulls.get(review.pull);
        const { id } = upsert.get(
          review.platform,
          review.review_key,
          review.listing,
          review.star,
          review.title,
          review.text,
          review.posted_at,
          review.verified ? 1 : 0,
          review.locator,
          now,
          now,
        ) as { id: number };
        link.run(
          runId,
          id,
          review.ref,
          pull?.target_id ?? "",
          pull?.source_id ?? "",
          pull?.band_requested ?? null,
        );
      }
    });
    write();
    return ledger.reviews.length;
  }

  list(runId: string): StoredRunReview[] {
    const rows = this.db
      .prepare(
        "SELECT l.*, r.platform, r.review_key, r.listing, r.star, r.title, r.text, r.posted_at," +
          " r.verified, r.locator FROM research_run_reviews l" +
          " JOIN research_reviews r ON r.id = l.review_id WHERE l.run_id = ? ORDER BY l.rowid",
      )
      .all(runId) as Array<Record<string, any>>;
    return rows.map((row) => ({
      run_id: row.run_id,
      ref: row.ref,
      target_id: row.target_id,
      source_id: row.source_id,
      band_requested: row.band_requested,
      platform: row.platform,
      review_key: row.review_key,
      listing: row.listing,
      star: row.star,
      title: row.title,
      text: row.text,
      posted_at: row.posted_at,
      verified: row.verified === 1,
      locator: row.locator,
    }));
  }
}
