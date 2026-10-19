import { createHash } from "node:crypto";

import { Ids, type CollectedReview, type ReviewCoverage, type ReviewStore, type ReviewTarget, type StoredReview } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** Reviews per target. Two copies of one review (the same text, from the same source) for the same target are one row: the content hash is unique per target. */
export class ReviewTable implements ReviewStore {
  constructor(private readonly db: SqlDatabase) {}

  static contentHash(review: CollectedReview): string {
    Trace.tick(import.meta.url, "ReviewTable.contentHash");
    const normal = review.body.toLowerCase().replace(/\s+/g, " ").trim();
    return createHash("sha256").update(`${review.source}\u001f${review.rating}\u001f${normal}`).digest("hex");
  }

  async save(accountId: string, target: ReviewTarget, reviews: readonly CollectedReview[]): Promise<number> {
    Trace.line(import.meta.url, "ReviewTable.save", { productId: target.product_id, competitorId: target.competitor_id, count: reviews.length });
    let inserted = 0;
    await this.db.transaction(async (tx) => {
      for (const review of reviews) {
        inserted += await tx.run(
          "INSERT INTO reviews (id, account_id, product_id, competitor_id, source, source_review_id, content_hash, rating, title, body, review_date," +
            " scraped_at, verified, helpful_votes, country) VALUES (?,?,?,?,?,?,?,?,?,?,?,now(),?,?,?) ON CONFLICT ON CONSTRAINT reviews_target_content DO NOTHING",
          [Ids.next(), accountId, target.product_id, target.competitor_id, review.source, review.source_review_id, ReviewTable.contentHash(review), review.rating,
            review.title, review.body, review.review_date, review.verified, review.helpful_votes, review.country],
        );
      }
    });
    return inserted;
  }

  async recordSources(target: ReviewTarget, sources: { asins: readonly string[]; reviewApp: string | null }): Promise<void> {
    Trace.line(import.meta.url, "ReviewTable.recordSources", { target: target.competitor_id ?? target.product_id, sources });
    const table = target.competitor_id ? "competitors" : "products";
    await this.db.run(`UPDATE ${table} SET asin_list = ?, review_app = ?, updated_at = now() WHERE id = ?`, [
      JSON.stringify(sources.asins),
      sources.reviewApp,
      target.competitor_id ?? target.product_id,
    ]);
  }

  async coverage(productId: string): Promise<ReviewCoverage[]> {
    Trace.line(import.meta.url, "ReviewTable.coverage", { productId });
    return this.db.all<ReviewCoverage>(
      "SELECT competitor_id, source, COUNT(*) AS reviews, AVG(rating) AS average_rating FROM reviews WHERE product_id = ?" +
        " GROUP BY competitor_id, source ORDER BY competitor_id NULLS FIRST, source",
      [productId],
    );
  }

  async all(productId: string): Promise<StoredReview[]> {
    Trace.line(import.meta.url, "ReviewTable.all", { productId });
    return this.db.all<StoredReview>(
      "SELECT id, product_id, competitor_id, source, rating, title, body, to_char(review_date, 'YYYY-MM-DD') AS review_date, verified, helpful_votes, scraped_at" +
        " FROM reviews WHERE product_id = ? ORDER BY id",
      [productId],
    );
  }

  async list(productId: string, competitorId: string | null, limit: number, offset: number): Promise<StoredReview[]> {
    Trace.line(import.meta.url, "ReviewTable.list", { productId, competitorId, limit, offset });
    return this.db.all<StoredReview>(
      "SELECT id, product_id, competitor_id, source, rating, title, body, to_char(review_date, 'YYYY-MM-DD') AS review_date, verified, helpful_votes, scraped_at" +
        " FROM reviews WHERE product_id = ? AND competitor_id IS NOT DISTINCT FROM ? ORDER BY rating, helpful_votes DESC, id LIMIT ? OFFSET ?",
      [productId, competitorId, limit, offset],
    );
  }
}
