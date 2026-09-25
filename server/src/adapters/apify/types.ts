export interface ReviewExcerpt {
  text: string;
  star: number | null;
  date: string | null;
  locator: string;
  title: string;
  verified: boolean;
  source: "amazon" | "trustpilot";
  reviewKey: string;
}

export interface ReviewResult {
  excerpts: ReviewExcerpt[];
  gap: string | null;
  offBand: number;
  totalReviews: number | null;
  totalRatings: number | null;
}

export interface AmazonProduct {
  asin: string;
  title: string;
  stars: number | null;
  reviewsCount: number | null;
  url: string;
}
