import type { Settings } from "../../config/index.js";
import type { CollectedReview, ReviewListing, ReviewSource } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { Http } from "../http.js";

import { ReviewText } from "./review-text.js";

interface JudgemeReview {
  uuid?: string;
  title?: string;
  rating?: number;
  body_html?: string;
  verified_buyer?: boolean;
  created_at?: string;
  thumb_up?: number;
  location_country_code?: string;
}

interface JudgemePage {
  reviews?: JudgemeReview[];
  pagination?: { total_pages?: number };
}

/** A Shopify store's Judge.me reviews, through the public endpoint its own widget calls; free, 30 a page at most, measured 2026-10-17. */
export class JudgemeReviews implements ReviewSource {
  readonly name = "judgeme" as const;
  static readonly PAGE_SIZE = 30;
  static readonly BASE = "https://judge.me/reviews/reviews_for_widget";

  constructor(private readonly settings: Settings) {}

  async collect(listing: ReviewListing, limit: number, signal?: AbortSignal): Promise<CollectedReview[]> {
    Trace.line(import.meta.url, "JudgemeReviews.collect", { listing, limit });
    if (listing.source !== "judgeme") return [];
    const reviews: CollectedReview[] = [];
    for (let page = 1; reviews.length < limit; page++) {
      const answer = await this.page(listing.shop_domain, listing.product_id, page, signal);
      reviews.push(...(answer.reviews ?? []).map(JudgemeReviews.review).filter((review): review is CollectedReview => review !== null));
      if (page >= (answer.pagination?.total_pages ?? 0) || (answer.reviews ?? []).length === 0) break;
    }
    return reviews.slice(0, limit);
  }

  private async page(shop: string, productId: string, page: number, signal?: AbortSignal): Promise<JudgemePage> {
    Trace.line(import.meta.url, "JudgemeReviews.page", { shop, page });
    const query = new URLSearchParams({ url: shop, shop_domain: shop, platform: "shopify", page: String(page), per_page: String(JudgemeReviews.PAGE_SIZE), product_id: productId });
    const response = await Http.withTimeout(`${JudgemeReviews.BASE}?${query}`, { headers: { Accept: "application/json" } }, this.settings.webTimeoutSeconds, signal);
    if (!response.ok) throw new Error(`Judge.me returned ${response.status} for ${shop} product ${productId}`);
    return (await response.json()) as JudgemePage;
  }

  static review(row: JudgemeReview): CollectedReview | null {
    Trace.tick(import.meta.url, "JudgemeReviews.review");
    const body = ReviewText.fromHtml(row.body_html ?? "");
    if (!body || typeof row.rating !== "number" || !row.uuid) return null;
    return {
      source: "judgeme",
      source_review_id: row.uuid,
      rating: row.rating,
      title: row.title ?? "",
      body,
      review_date: row.created_at ? row.created_at.slice(0, 10) : null,
      verified: row.verified_buyer ?? null,
      helpful_votes: row.thumb_up ?? 0,
      country: row.location_country_code || null,
    };
  }
}
