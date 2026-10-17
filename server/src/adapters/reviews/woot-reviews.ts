import { createHash } from "node:crypto";

import type { Settings } from "../../config/index.js";
import { STAR_BANDS, type CollectedReview, type ReviewListing, type ReviewSource, type StarBand } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { Http } from "../http.js";

import { ReviewText } from "./review-text.js";

interface WootReview {
  Author?: string;
  Title?: string;
  Text?: string;
  OverallRating?: number;
  IsVerifiedPurchase?: boolean;
  HelpfulVotes?: number;
  OriginDescription?: string;
}

interface WootPage {
  Reviews?: WootReview[];
  PagingNext?: string | null;
}

/** Amazon US reviews through woot.com's review endpoint (Amazon-owned, no login, free), one star band at a time, 10 a page, paced; measured working 2026-10-17. */
export class WootReviews implements ReviewSource {
  readonly name = "amazon" as const;
  static readonly BASE = "https://www.woot.com/review/Reviews/";
  static readonly USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) Chrome/139.0 Safari/537.36";
  private static readonly DATE = / on ([A-Z][a-z]+ \d{1,2}, \d{4})$/;

  constructor(private readonly settings: Settings) {}

  async collect(listing: ReviewListing, limit: number, signal?: AbortSignal): Promise<CollectedReview[]> {
    Trace.line(import.meta.url, "WootReviews.collect", { listing, limit });
    if (listing.source !== "amazon") return [];
    const reviews: CollectedReview[] = [];
    for (const band of STAR_BANDS) {
      if (reviews.length >= limit || signal?.aborted) break;
      reviews.push(...(await this.band(listing.asin, band, Math.min(this.settings.reviewsPerBand, limit - reviews.length), signal)));
    }
    return reviews;
  }

  private async band(asin: string, band: StarBand, limit: number, signal?: AbortSignal): Promise<CollectedReview[]> {
    Trace.line(import.meta.url, "WootReviews.band", { asin, band, limit });
    const reviews: CollectedReview[] = [];
    let cursor: string | null = null;
    do {
      const page = await this.page(asin, band, cursor, signal);
      reviews.push(...(page.Reviews ?? []).map(WootReviews.review).filter((review): review is CollectedReview => review !== null && review.rating === band));
      cursor = (page.Reviews ?? []).length > 0 ? (page.PagingNext ?? null) : null;
    } while (cursor && reviews.length < limit && !signal?.aborted);
    return reviews.slice(0, limit);
  }

  private async page(asin: string, band: StarBand, cursor: string | null, signal?: AbortSignal): Promise<WootPage> {
    Trace.line(import.meta.url, "WootReviews.page", { asin, band, next: cursor !== null });
    await new Promise((resolve) => setTimeout(resolve, this.settings.wootDelayMs));
    const query = new URLSearchParams({ filter: String(band), isVerified: "false", sort: "0", ...(cursor ? { pagingNext: cursor } : { page: "1" }) });
    const headers = { "User-Agent": WootReviews.USER_AGENT, Accept: "application/json", "X-Requested-With": "XMLHttpRequest", Referer: `https://www.woot.com/review/${asin}` };
    const response = await Http.withTimeout(`${WootReviews.BASE}${asin}?${query}`, { headers }, this.settings.webTimeoutSeconds, signal);
    if (!response.ok) throw new Error(`Woot returned ${response.status} for ${asin} band ${band}`);
    return (await response.json()) as WootPage;
  }

  static review(row: WootReview): CollectedReview | null {
    Trace.tick(import.meta.url, "WootReviews.review");
    const body = ReviewText.decode(row.Text ?? "").trim();
    if (!body || typeof row.OverallRating !== "number") return null;
    const title = ReviewText.decode(row.Title ?? "");
    return {
      source: "amazon",
      source_review_id: `woot-${createHash("sha256").update(`${row.Author ?? ""}\u001f${title}\u001f${body}`).digest("hex").slice(0, 16)}`,
      rating: row.OverallRating,
      title,
      body,
      review_date: WootReviews.date(row.OriginDescription ?? ""),
      verified: row.IsVerifiedPurchase ?? null,
      helpful_votes: row.HelpfulVotes ?? 0,
      country: null,
    };
  }

  static date(origin: string): string | null {
    Trace.tick(import.meta.url, "WootReviews.date");
    const match = WootReviews.DATE.exec(origin.trim());
    const parsed = match ? new Date(`${match[1]} UTC`) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
  }
}
