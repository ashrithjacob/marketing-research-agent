import type { LedgerExcerpt, ReviewLedger } from "../../domain/index.js";
import type { ReviewExcerpt, ReviewResult } from "../../adapters/apify/index.js";

export type LedgerResult = Omit<ReviewResult, "excerpts"> & {
  excerpts: LedgerExcerpt[];
};

export interface ReviewPullOutcome {
  result: ReviewResult;
  knownCount: number;
  fetchedCount: number;
  fromLedger: boolean;
}

/** Caches pulled reviews so a repeat run spends Apify budget only on the delta. */
export class ReviewPull {
  constructor(private readonly ledger: ReviewLedger | null) {}

  static readonly AMAZON_PREFIX = "amazon|";
  static readonly TRUSTPILOT_PREFIX = "trustpilot|";

  static amazonKey(productUrl: string, star: 1 | 2 | 3 | 4 | 5 | null): string {
    return ReviewPull.AMAZON_PREFIX + (star ?? "any") + "|" + productUrl.toLowerCase();
  }

  static trustpilotKey(domainOrUrl: string, star: 1 | 2 | 3 | 4 | 5 | null): string {
    return ReviewPull.TRUSTPILOT_PREFIX + (star ?? "any") + "|" + domainOrUrl.toLowerCase();
  }

  async collect(
    bandKey: string,
    limit: number,
    runId: string,
    source: ReviewExcerpt["source"],
    fetch: (maxReviews: number) => Promise<LedgerResult>,
  ): Promise<ReviewPullOutcome> {
    const cached = this.ledger ? this.ledger.cached(bandKey, limit) : [];
    if (cached.length >= limit) {
      return {
        result: this.asResult(cached.slice(0, limit), source),
        knownCount: cached.length,
        fetchedCount: 0,
        fromLedger: true,
      };
    }
    const wanted = limit - cached.length;
    const fetched = await fetch(wanted);
    const known = new Set(cached.map((excerpt) => excerpt.locator));
    const fresh = fetched.excerpts
      .filter((excerpt) => excerpt.locator !== "" && !known.has(excerpt.locator))
      .map((excerpt) => ({
        text: excerpt.text,
        star: excerpt.star,
        date: excerpt.date,
        locator: excerpt.locator,
        title: excerpt.title,
        verified: excerpt.verified,
      }));
    if (fresh.length > 0) this.ledger?.record(bandKey, runId, fresh);
    return {
      result: {
        excerpts: this.withSource([...cached, ...fresh], source),
        gap: fetched.gap,
        discarded: fetched.discarded,
        totalReviews: fetched.totalReviews,
        totalRatings: fetched.totalRatings,
      },
      knownCount: cached.length,
      fetchedCount: wanted,
      fromLedger: false,
    };
  }

  private withSource(excerpts: LedgerExcerpt[], source: ReviewExcerpt["source"]): ReviewExcerpt[] {
    return excerpts.map((excerpt) => ({ ...excerpt, source }));
  }

  private asResult(excerpts: LedgerExcerpt[], source: ReviewExcerpt["source"]): ReviewResult {
    return {
      excerpts: this.withSource(excerpts, source),
      gap: null,
      discarded: 0,
      totalReviews: null,
      totalRatings: null,
    };
  }
}
