import type { ReviewExcerpt } from "../adapters/apify/index.js";
import type { LedgerPull, LedgerReview, ReviewLedgerSnapshot } from "../domain/index.js";

/** Every review this run has fetched, under a short ref, so the packet and the database get them without the model copying any. */
export class ReviewLedger {
  private readonly pulls: LedgerPull[] = [];
  private readonly reviews: LedgerReview[] = [];
  private readonly keys = new Set<string>();

  record(
    pull: Omit<LedgerPull, "handle">,
    excerpts: readonly ReviewExcerpt[],
  ): { handle: string; added: LedgerReview[]; repeats: number } {
    const handle = `p${this.pulls.length + 1}`;
    this.pulls.push({ ...pull, handle });
    const added: LedgerReview[] = [];
    let repeats = 0;
    for (const excerpt of excerpts) {
      const key = `${excerpt.source}\n${excerpt.reviewKey}`;
      if (this.keys.has(key)) {
        repeats += 1;
        continue;
      }
      this.keys.add(key);
      const review: LedgerReview = {
        ref: `r${this.pulls.length}.${added.length + 1}`,
        pull: handle,
        platform: excerpt.source,
        review_key: excerpt.reviewKey,
        listing: pull.listing,
        star: excerpt.star,
        title: excerpt.title,
        text: excerpt.text,
        posted_at: excerpt.date ?? "",
        verified: excerpt.verified,
        locator: excerpt.locator,
      };
      this.reviews.push(review);
      added.push(review);
    }
    return { handle, added, repeats };
  }

  size(): number {
    return this.reviews.length;
  }

  snapshot(): ReviewLedgerSnapshot {
    return {
      pulls: this.pulls.map((pull) => ({ ...pull })),
      reviews: this.reviews.map((review) => ({ ...review })),
    };
  }
}
