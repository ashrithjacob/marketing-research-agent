export type ReviewPlatform = "amazon" | "trustpilot";

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
