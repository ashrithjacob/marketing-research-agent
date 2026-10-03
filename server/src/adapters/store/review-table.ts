import {
  Clock,
  type LedgerPull,
  type ReviewLedgerSnapshot,
  type StoredRunReview,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** The review corpus: each real review stored once, linked to every run that pulled it, in the order the run's ledger held them. */
export class ReviewTable {
  constructor(private readonly db: SqlDatabase) {}

  async save(runId: string, productId: string, ledger: ReviewLedgerSnapshot): Promise<number> {
    Trace.line(import.meta.url, "ReviewTable.save", { runId, productId, ledger });
    const pulls = new Map<string, LedgerPull>(ledger.pulls.map((pull) => [pull.handle, pull]));
    const now = Clock.nowIso();
    await this.db.transaction(async (tx) => {
      for (const [seq, review] of ledger.reviews.entries()) {
        const pull = pulls.get(review.pull);
        const stored = await tx.get<{ id: number }>(
          "INSERT INTO research_reviews (platform, review_key, listing, star, title, text, posted_at," +
            " verified, locator, first_seen_at, last_seen_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)" +
            " ON CONFLICT(platform, review_key) DO UPDATE SET last_seen_at = excluded.last_seen_at" +
            " RETURNING id",
          [review.platform, review.review_key, review.listing, review.star, review.title, review.text,
            review.posted_at, review.verified ? 1 : 0, review.locator, now, now],
        );
        await tx.run(
          "INSERT INTO research_run_reviews (run_id, product_id, review_id, seq, ref, target_id, source_id, band_requested)" +
            " VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(run_id, review_id) DO UPDATE SET product_id = excluded.product_id," +
            " seq = excluded.seq, ref = excluded.ref, target_id = excluded.target_id, source_id = excluded.source_id," +
            " band_requested = excluded.band_requested",
          [runId, productId, stored!.id, seq, review.ref, pull?.target_id ?? "", pull?.source_id ?? "", pull?.band_requested ?? null],
        );
      }
    });
    return ledger.reviews.length;
  }

  async list(runId: string): Promise<StoredRunReview[]> {
    Trace.line(import.meta.url, "ReviewTable.list", { runId });
    const rows = await this.db.all(
      "SELECT l.*, r.platform, r.review_key, r.listing, r.star, r.title, r.text, r.posted_at," +
        " r.verified, r.locator FROM research_run_reviews l" +
        " JOIN research_reviews r ON r.id = l.review_id WHERE l.run_id = ? ORDER BY l.seq, l.review_id",
      [runId],
    );
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
