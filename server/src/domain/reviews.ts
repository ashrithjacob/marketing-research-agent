export type ReviewPlatform = "amazon" | "trustpilot";

export interface ReviewExcerpt {
  text: string;
  star: number | null;
  date: string | null;
  locator: string;
  title: string;
  verified: boolean;
  source: ReviewPlatform;
  reviewKey: string;
}

export interface ReviewResult {
  /** The actor run's final status: SUCCEEDED, or FAILED / TIMED-OUT / ABORTED when the run itself went wrong. */
  status: string;
  excerpts: ReviewExcerpt[];
  gap: string | null;
  offBand: number;
  totalReviews: number | null;
  totalRatings: number | null;
  /** When the service produced this answer, set only on one reused from an earlier pull; absent means just now. */
  fetchedAt?: string;
}


export interface LedgerPull {
  handle: string;
  source_id: string;
  target_id: string;
  platform: ReviewPlatform;
  listing: string;
  band_requested: number | null;
  fetched_at: string;
  archived: boolean;
  total_reviews: number | null;
  total_ratings: number | null;
  gap: string | null;
}

export interface LedgerReview {
  ref: string;
  pull: string;
  platform: ReviewPlatform;
  review_key: string;
  listing: string;
  star: number | null;
  title: string;
  text: string;
  posted_at: string;
  verified: boolean;
  locator: string;
}

export interface ReviewLedgerSnapshot {
  pulls: readonly LedgerPull[];
  reviews: readonly LedgerReview[];
}

export const EMPTY_LEDGER: ReviewLedgerSnapshot = { pulls: [], reviews: [] };

export interface StoredRunReview {
  run_id: string;
  ref: string;
  target_id: string;
  source_id: string;
  band_requested: number | null;
  platform: ReviewPlatform;
  review_key: string;
  listing: string;
  star: number | null;
  title: string;
  text: string;
  posted_at: string;
  verified: boolean;
  locator: string;
}

/** A pull's answer as kept for reuse: the review service's own result, and when it was fetched. */
export interface StoredPull {
  pulled_at: string;
  requested: number | null;
  result: ReviewResult;
}
