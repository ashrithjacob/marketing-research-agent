import { Trace } from "../trace/index.js";

import type { Market } from "./analysis-input.js";

export const SUGGESTION_SOURCES = ["google", "amazon"] as const;
export type SuggestionSource = (typeof SUGGESTION_SOURCES)[number];

/** A page as the Wayback Machine archived it on one day. */
export interface ArchivedPage {
  url: string;
  timestamp: string;
}

/** One query's monthly searches on Google, as the Google Ads planner reports them. */
export interface KeywordVolume {
  keyword: string;
  monthly_searches: number | null;
  intent: string | null;
  trend: string | null;
}

/** One result on an Amazon search page. */
export interface MarketplaceListing {
  asin: string;
  title: string;
  url: string;
  keyword: string;
  rating: number | null;
  ratings_count: number | null;
  price: number | null;
  sponsored: boolean;
  organic_position: number | null;
}

/** A Reddit post or comment, as written. */
export interface ForumPost {
  id: string;
  kind: "post" | "comment";
  url: string;
  subreddit: string;
  title: string | null;
  body: string;
  score: number | null;
  posted_at: string | null;
}

export interface ForumQuery {
  keywords: readonly string[];
  subreddits: readonly string[];
  maxPosts: number;
  commentsPerPost: number;
}

/** What one Apify actor run returned and what Apify charged for it (platform usage and per-event charges together, measured 2026-10-20). */
export interface ActorRun {
  status: string;
  items: Array<Record<string, unknown>>;
  usd: number | null;
}

export interface ActorLimits {
  maxTotalChargeUsd: number | null;
  timeoutSeconds: number;
  memoryMb: number;
}

/** Which country code each outside source takes for a run's first market; null where the source has no such market or it was never seen working. */
export class SourceMarkets {
  private static readonly KEYWORD_COUNTRY: Readonly<Partial<Record<Market, string>>> = { US: "us", GB: "gb", CA: "ca", AU: "au", NZ: "nz" };
  private static readonly AMAZON: Readonly<Partial<Record<Market, string>>> = { US: "us", GB: "uk", EU: "de" };
  private static readonly AMAZON_SUGGEST: Readonly<Partial<Record<Market, { host: string; mid: string }>>> = {
    US: { host: "completion.amazon.com", mid: "ATVPDKIKX0DER" },
    GB: { host: "completion.amazon.co.uk", mid: "A1F83G8C2ARO7P" },
  };

  static keywordCountry(market: Market): string | null {
    Trace.line(import.meta.url, "SourceMarkets.keywordCountry", { market });
    return SourceMarkets.KEYWORD_COUNTRY[market] ?? null;
  }

  static amazonMarketplace(market: Market): string | null {
    Trace.line(import.meta.url, "SourceMarkets.amazonMarketplace", { market });
    return SourceMarkets.AMAZON[market] ?? null;
  }

  static amazonSuggest(market: Market): { host: string; mid: string } | null {
    Trace.line(import.meta.url, "SourceMarkets.amazonSuggest", { market });
    return SourceMarkets.AMAZON_SUGGEST[market] ?? null;
  }

  static googleCountry(market: Market): string {
    Trace.line(import.meta.url, "SourceMarkets.googleCountry", { market });
    return market === "EU" ? "ie" : market.toLowerCase();
  }
}
