import type { AnalysedReview, StoredRunReview } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Drops reviews with nothing to analyse and the same review met twice; pure. */
export class ReviewCleaner {
  static readonly MIN_WORDS = 3;

  static clean(stored: readonly StoredRunReview[]): { kept: AnalysedReview[]; duplicates: number; empty: number } {
    Trace.line(import.meta.url, "ReviewCleaner.clean", { reviews: stored.length });
    const seen = new Set<string>();
    const kept: AnalysedReview[] = [];
    let duplicates = 0;
    let empty = 0;
    for (const review of stored) {
      const words = ReviewCleaner.words(review.text);
      if (words.length < ReviewCleaner.MIN_WORDS) {
        empty += 1;
        continue;
      }
      const key = `${review.star ?? "-"}|${words.join(" ")}`;
      if (seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);
      kept.push({
        ref: review.ref,
        target_id: review.target_id,
        platform: review.platform,
        star: review.star,
        title: review.title.trim(),
        text: review.text.trim(),
        locator: review.locator,
      });
    }
    return { kept, duplicates, empty };
  }

  private static words(text: string): string[] {
    Trace.tick(import.meta.url, "ReviewCleaner.words", {});
    return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word !== "");
  }
}
