import type { Corpus } from "../adapters/corpus.js";
import { Clock, type ReviewPlatform, type ReviewResult } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ReviewLedger } from "./review-ledger.js";

export interface PullLabel {
  target_id: string;
  platform: ReviewPlatform;
  listing: string;
  band: 1 | 2 | 3 | 4 | 5 | null;
}

/** Archives one pull verbatim under its hash and files its reviews in the run's review ledger. */
export class ReviewFiling {
  constructor(
    private readonly corpus: Corpus,
    private readonly runId: string,
    private readonly ledger: ReviewLedger,
  ) {}

  async file(label: PullLabel, result: ReviewResult): Promise<{ handle: string; added: number }> {
    Trace.line(import.meta.url, "ReviewFiling.file", { label, reviews: result.excerpts.length });
    const { sourceId, archived } = await this.corpus.write(this.runId, JSON.stringify(result.excerpts, null, 2));
    const filed = this.ledger.record(
      {
        source_id: sourceId,
        target_id: label.target_id,
        platform: label.platform,
        listing: label.listing,
        band_requested: label.band,
        fetched_at: result.fetchedAt ?? Clock.nowIso(),
        archived,
        total_reviews: result.totalReviews,
        total_ratings: result.totalRatings,
        gap: result.gap,
      },
      result.excerpts,
    );
    return { handle: filed.handle, added: filed.added.length };
  }
}
