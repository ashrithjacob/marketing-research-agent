import type { AnalysedReview } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** The reviews the issue catalogue is drawn from: every 3-star review first, then a spread of the rest per product. */
export class ReviewSample {
  static readonly THREE_STAR_CAP = 400;
  static readonly PER_PRODUCT_PER_STAR = 8;
  static readonly OTHER_STARS = [2, 4, 1, 5] as const;

  static forCatalog(reviews: readonly AnalysedReview[]): AnalysedReview[] {
    Trace.line(import.meta.url, "ReviewSample.forCatalog", { reviews: reviews.length });
    const threeStar = reviews.filter((review) => review.star === 3).slice(0, ReviewSample.THREE_STAR_CAP);
    const rest: AnalysedReview[] = [];
    const targets = [...new Set(reviews.map((review) => review.target_id))];
    for (const star of ReviewSample.OTHER_STARS) {
      for (const target of targets) {
        rest.push(
          ...reviews
            .filter((review) => review.star === star && review.target_id === target)
            .sort((a, b) => b.text.length - a.text.length)
            .slice(0, ReviewSample.PER_PRODUCT_PER_STAR),
        );
      }
    }
    return [...threeStar, ...rest];
  }

  static batches(reviews: readonly AnalysedReview[], size: number): AnalysedReview[][] {
    Trace.line(import.meta.url, "ReviewSample.batches", { reviews: reviews.length, size });
    const out: AnalysedReview[][] = [];
    for (let start = 0; start < reviews.length; start += size) out.push(reviews.slice(start, start + size));
    return out;
  }
}
