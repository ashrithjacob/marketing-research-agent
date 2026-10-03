import type { ReviewExcerpt, ReviewPlatform, ReviewResult } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

type StoredReview = {
  platform: ReviewPlatform;
  listing: string;
  band: number | null;
  review_key: string;
  star: number | null;
  title: string;
  text: string;
  posted_at: string;
  verified: number;
  locator: string;
  first_seen_at: string;
};

/** Gives every listing and star band mined before pulls were kept (2026-10-03) a kept pull, made of the reviews stored from it, so a later run reuses them instead of paying again. Runs once. */
export class ReviewPullBackfill {
  static readonly NAME = "review-pulls-from-stored-reviews";

  constructor(private readonly db: SqlDatabase) {}

  async apply(): Promise<number> {
    Trace.line(import.meta.url, "ReviewPullBackfill.apply");
    const rows = await this.db.all<StoredReview>(
      "SELECT DISTINCT r.platform, r.listing, l.band_requested AS band, r.review_key, r.star, r.title, r.text, r.posted_at," +
        " r.verified, r.locator, r.first_seen_at FROM research_run_reviews l JOIN research_reviews r ON r.id = l.review_id" +
        " ORDER BY r.platform, r.listing, r.review_key",
    );
    const pulls = new Map<string, StoredReview[]>();
    for (const row of rows) {
      const key = JSON.stringify([row.platform, row.listing, row.band]);
      pulls.set(key, [...(pulls.get(key) ?? []), row]);
    }
    let kept = 0;
    for (const reviews of pulls.values()) {
      const { platform, listing, band } = reviews[0]!;
      const exists = await this.db.get(
        "SELECT 1 AS kept FROM research_review_pulls WHERE platform = ? AND listing = ? AND band IS NOT DISTINCT FROM ?",
        [platform, listing, band],
      );
      if (exists) continue;
      const pulledAt = reviews.map((review) => review.first_seen_at).sort()[0]!;
      await this.db.run(
        "INSERT INTO research_review_pulls (platform, listing, band, pulled_at, result) VALUES (?,?,?,?,?)",
        [platform, listing, band, pulledAt, JSON.stringify(ReviewPullBackfill.result(reviews))],
      );
      kept += 1;
    }
    return kept;
  }

  private static result(reviews: StoredReview[]): ReviewResult {
    Trace.line(import.meta.url, "ReviewPullBackfill.result", { reviews: reviews.length });
    const excerpts: ReviewExcerpt[] = reviews.map((review) => ({
      text: review.text,
      star: review.star,
      date: review.posted_at || null,
      locator: review.locator,
      title: review.title,
      verified: review.verified === 1,
      source: review.platform,
      reviewKey: review.review_key,
    }));
    return { status: "SUCCEEDED", excerpts, gap: null, offBand: 0, totalReviews: null, totalRatings: null };
  }
}
