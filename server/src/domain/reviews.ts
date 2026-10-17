import { z } from "zod/v4";

import { Trace } from "../trace/index.js";

export const REVIEW_SOURCES = ["judgeme", "amazon"] as const;
export type ReviewSourceName = (typeof REVIEW_SOURCES)[number];

/** Star bands in the order they are collected: the middle and the complaints first, because praise is never scarce. */
export const STAR_BANDS = [3, 1, 2, 4, 5] as const;
export type StarBand = (typeof STAR_BANDS)[number];

export type ReviewListing = { source: "amazon"; asin: string } | { source: "judgeme"; shop_domain: string; product_id: string };

/** One review as a source returned it, the text exactly as written. */
export interface CollectedReview {
  source: ReviewSourceName;
  source_review_id: string;
  rating: number;
  title: string;
  body: string;
  review_date: string | null;
  verified: boolean | null;
  helpful_votes: number;
  country: string | null;
}

/** Whose reviews these are: the client's product (no competitor) or one confirmed competitor of it. */
export interface ReviewTarget {
  product_id: string;
  competitor_id: string | null;
  name: string;
  url: string;
}

export interface StoredReview {
  id: string;
  product_id: string;
  competitor_id: string | null;
  source: ReviewSourceName;
  rating: number;
  title: string;
  body: string;
  review_date: string | null;
  verified: boolean | null;
  helpful_votes: number;
  scraped_at: string;
}

export interface ReviewCoverage {
  competitor_id: string | null;
  source: ReviewSourceName;
  reviews: number;
  average_rating: number | null;
}

/** What a Shopify product page says about its store: the shop's own domain, the product's id, and which review apps its theme loads. */
export interface StorefrontFacts {
  shop_domain: string;
  product_id: string;
  review_apps: string[];
}

/** What the listing finder hands back: the Amazon page of the same product, or null when there is none. */
export const AmazonListingSchema = z.object({
  amazon_url: z.url().nullable().describe("The product's own Amazon page (…/dp/ASIN), as it appeared in a search result, or null."),
  why: z.string().min(1).describe("One line: why this listing is the same product, or why there is none."),
});
export type AmazonListing = z.infer<typeof AmazonListingSchema>;

export class Asins {
  private static readonly IN_PATH = /\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})(?:[/?]|$)/;

  static fromUrl(url: string): string | null {
    Trace.line(import.meta.url, "Asins.fromUrl", { url });
    try {
      const parsed = new URL(url);
      if (!/(^|\.)amazon\.[a-z.]+$/.test(parsed.hostname)) return null;
      return Asins.IN_PATH.exec(parsed.pathname)?.[1] ?? null;
    } catch {
      return null;
    }
  }
}
