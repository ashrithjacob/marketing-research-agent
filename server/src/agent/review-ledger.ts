import type { ReviewExcerpt } from "../adapters/apify/index.js";
import type { LedgerPull, LedgerReview, ResearchStore, ReviewLedgerSnapshot } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";

/** Every review this run has fetched, under a short ref, so the packet and the database get them without the model copying any. */
export class ReviewLedger {
  private readonly pulls: LedgerPull[] = [];
  private readonly reviews: LedgerReview[] = [];
  private readonly keys = new Set<string>();

  record(
    pull: Omit<LedgerPull, "handle">,
    excerpts: readonly ReviewExcerpt[],
  ): { handle: string; added: LedgerReview[]; repeats: number } {
    Trace.line(import.meta.url, "ReviewLedger.record", { pull, excerpts });
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
    Trace.line(import.meta.url, "ReviewLedger.size");
    return this.reviews.length;
  }

  saveTo(store: ResearchStore, runs: LiveRuns, runId: string): void {
    Trace.line(import.meta.url, "ReviewLedger.saveTo", { runId });
    try {
      const saved = store.saveRunReviews(runId, this.snapshot());
      if (saved > 0) runs.emit(runId, "reviews.saved", { reviews: saved });
    } catch (error) {
      console.error(`research run ${runId}: saving the reviews failed`, error);
    }
  }

  snapshot(): ReviewLedgerSnapshot {
    Trace.line(import.meta.url, "ReviewLedger.snapshot");
    return {
      pulls: this.pulls.map((pull) => ({ ...pull })),
      reviews: this.reviews.map((review) => ({ ...review })),
    };
  }
}
