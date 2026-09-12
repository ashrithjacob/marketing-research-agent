/**
 * A TrendTrack client that remembers what it already paid for.
 *
 * ## Why the cache sits here and not on the result
 *
 * The obvious cache is the whole stage-0 result: same parameters, same answer,
 * no credits. It is also nearly useless, because the parameters you want to
 * change are the cheap ones. `minUps`, `minBaseline`, `minTrustpilotRating` and
 * the whole MRR rubric are applied *client-side* to rows that have already been
 * bought — so caching at the result level means paying 500 credits again to see
 * what a baseline of 30,000 would have kept.
 *
 * Caching each API response instead makes the split fall where the money is:
 *
 * | Change | Costs |
 * |---|---|
 * | `minUps`, `minBaseline`, Trustpilot floor, batch size, model | **nothing** |
 * | `pages`, `minMonthlyVisits`, `minActiveAds`, `minProductsCount`, growth | new rows |
 *
 * Detail calls are keyed by shop id, so they are reused across *different*
 * searches too: a shop that appears in two queries is bought once.
 *
 * ## Why a week is a defensible TTL
 *
 * `GET /v1/system/freshness` reports `dataFreshnessLagDays: 1` and a daily
 * rebuild, so a cached row can be up to eight days behind the world. What stage
 * 0 reads from these rows is a six-month monthly traffic series and a Trustpilot
 * rating — both of which move on a scale of months. A week of staleness cannot
 * change which shops are compounding. It could matter for `activeAds`, which is
 * a 30-day figure, so that is worth knowing when reading a cached run.
 *
 * This is a screening cache. Nothing here should be used to make a claim about
 * what a shop is doing *today*.
 */

import { createHash } from "node:crypto";

import type { ResearchStore } from "./store.js";
import {
  emptyLedger,
  type CreditLedger,
  type Pagination,
  type ShopDetail,
  type ShopQuery,
  type ShopSummary,
  type TrendTrackClient,
} from "./trendtrack.js";

export const DEFAULT_CACHE_DAYS = 7;

/**
 * Stable key for a request.
 *
 * Object keys are sorted so `{a, b}` and `{b, a}` are one entry; array order is
 * preserved because `trafficGrowth` is a sequence of conditions joined by
 * `operator`, and reordering it changes the query.
 */
export function canonicalKey(kind: string, value: unknown): string {
  const canonical = JSON.stringify(sortKeys(value));
  return `${kind}:${createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const inner = (value as Record<string, unknown>)[key];
      // Undefined and null are the same thing to this API — an absent filter —
      // so they must not produce two keys for one request.
      if (inner === undefined || inner === null) continue;
      out[key] = sortKeys(inner);
    }
    return out;
  }
  return value;
}

/** What the cache did, reported alongside the bill. */
export interface CacheLedger {
  /** Responses served from cache. */
  hits: number;
  /** Responses fetched and stored. */
  misses: number;
  /** Entries found but too old to use. */
  stale: number;
  /** Credits not spent because a response was already paid for. */
  creditsSaved: number;
  /** How old the oldest response used in this run was, in seconds. */
  oldestUsedSeconds: number;
}

export function emptyCacheLedger(): CacheLedger {
  return { hits: 0, misses: 0, stale: 0, creditsSaved: 0, oldestUsedSeconds: 0 };
}

export class CachedTrendTrackClient implements TrendTrackClient {
  readonly ledger: CreditLedger;
  readonly cache = emptyCacheLedger();

  private readonly delegate: TrendTrackClient;
  private readonly store: ResearchStore;
  private readonly maxAgeSeconds: number;

  constructor(options: {
    delegate: TrendTrackClient;
    store: ResearchStore;
    /** 0 or less disables the cache entirely, reads and writes both. */
    maxAgeSeconds: number;
  }) {
    this.delegate = options.delegate;
    this.store = options.store;
    this.maxAgeSeconds = options.maxAgeSeconds;
    // The delegate's ledger is the real bill, so it is shared rather than
    // copied: a cache hit must not appear as a credit spent.
    this.ledger = options.delegate.ledger ?? emptyLedger();
  }

  get enabled(): boolean {
    return this.maxAgeSeconds > 0;
  }

  /** The TTL, in the unit the operator set it in. */
  get maxAgeDays(): number {
    return Math.round((this.maxAgeSeconds / 86400) * 100) / 100;
  }

  async queryShops(
    query: ShopQuery,
    signal?: AbortSignal,
  ): Promise<{ data: ShopSummary[]; pagination: Pagination }> {
    return await this.through(
      canonicalKey("query", query),
      "query",
      // A search is billed per row, so what it saves depends on what it returned.
      (value) => value.data.length,
      () => this.delegate.queryShops(query, signal),
    );
  }

  async getShop(shopId: string, signal?: AbortSignal): Promise<ShopDetail> {
    return await this.through(
      `shop:${shopId}`,
      "shop",
      () => 1,
      () => this.delegate.getShop(shopId, signal),
    );
  }

  /** Never cached: it is free, and its whole purpose is to be current. */
  async getUsage(signal?: AbortSignal): Promise<{ remaining: number; limit: number; used: number }> {
    return await this.delegate.getUsage(signal);
  }

  private async through<T>(
    key: string,
    kind: string,
    price: (value: T) => number,
    fetch: () => Promise<T>,
  ): Promise<T> {
    if (!this.enabled) {
      this.cache.misses += 1;
      return await fetch();
    }

    const hit = this.store.getCached(key);
    if (hit && hit.payload != null) {
      if (hit.ageSeconds <= this.maxAgeSeconds) {
        this.cache.hits += 1;
        this.cache.creditsSaved += hit.credits;
        this.cache.oldestUsedSeconds = Math.max(this.cache.oldestUsedSeconds, hit.ageSeconds);
        return hit.payload as T;
      }
      this.cache.stale += 1;
    }

    const value = await fetch();
    this.cache.misses += 1;
    try {
      this.store.putCached({ key, kind, payload: value, credits: price(value) });
    } catch (error) {
      // A cache that cannot write is a slow cache, not a failed run. The
      // response is already paid for and in hand.
      console.error(`trendtrack cache: write failed for ${key}`, error);
    }
    return value;
  }
}
