/**
 * The TrendTrack API, as much of it as stage 0 needs.
 *
 * This module is the boundary and nothing else: it knows request shapes, response
 * shapes, and what a call costs. Every judgement about which shops are
 * interesting lives in `stage0.ts`, so that the filters can be tested without a
 * key and the wire format can change without touching them.
 *
 * **Credits are billed per returned row, not per call** (`trendtrack/product-finder.md`
 * §1, measured against `/v1/usage`). `POST /v1/shops/query` costs one credit per
 * shop it returns, so `limit` is the price; `GET /v1/shops/{id}` is one credit
 * flat. Nothing here retries a search: a retried page is a page paid for twice.
 */

import { fetchWithTimeout } from "./http.js";

export const TRENDTRACK_BASE_URL = "https://api.trendtrack.io";

/** Page size ceiling on `/v1/shops/query`, from the API's own contract. */
export const MAX_PAGE_SIZE = 100;

/**
 * Detail calls in flight at once.
 *
 * Measured 2026-09-12: six concurrent `GET /v1/shops/{id}` calls against one
 * credential returned `429 Too many concurrent public API requests are already
 * in flight for this workspace or credential` for three of seven shops. The
 * limit is on *concurrency*, not on a rate over time, so the fix is a smaller
 * pool rather than a slower one.
 */
export const DETAIL_CONCURRENCY = 3;

/** Attempts for a call that came back 429, including the first. */
const RETRY_ATTEMPTS = 4;

export interface TrafficPoint {
  period: string;
  value: number;
}

export interface CountryShare {
  countryCode: string;
  /** Fraction, not a percentage: 0.43 is 43% of visits. */
  share: number;
}

export interface BestSeller {
  title: string;
  price: number | null;
  currency: string;
  imageUrl?: string;
}

/**
 * A row from `/v1/shops/query`. Only the fields stage 0 reads are declared —
 * the API returns more, and declaring fields we ignore invites the impression
 * they are checked.
 *
 * `traffic` carries `growth30d` but **not** `growth90d` / `growth180d`: those
 * exist only on the detail call. Verified against the live API 2026-09-12.
 */
export interface ShopSummary {
  id: string;
  domain: string;
  name?: string;
  createdAt?: string;
  traffic: {
    monthlyVisits: number | null;
    growth30d: number | null;
    history: TrafficPoint[] | null;
    topCountries: CountryShare[] | null;
  } | null;
  advertising: { activeAds: number | null } | null;
  catalog: {
    productsCount: number | null;
    mainCategory?: string | null;
    bestSellers: BestSeller[] | null;
  } | null;
  profile: { countryCode?: string | null; currency?: string | null } | null;
}

/**
 * `/v1/shops/{id}`. Adds the two things stage 0 buys it for: the Trustpilot
 * block, and the long-window growth scalars that make a t-6 estimate possible.
 */
export interface ShopDetail extends ShopSummary {
  trustpilot: {
    rating: number | null;
    reviewCount: number | null;
    brandName?: string | null;
    url?: string | null;
  } | null;
  traffic:
    | (ShopSummary["traffic"] & {
        growth90d?: number | null;
        growth180d?: number | null;
      })
    | null;
}

/** A `trafficGrowth` / `adsGrowth` condition. `operator` links it to the next one. */
export interface GrowthCondition {
  period: "last30d" | "last90d" | "last180d";
  comparison: "greater" | "less";
  /** Percent, not a fraction: 50 means +50%. */
  value: number;
  operator?: "and" | "or";
}

/**
 * The subset of the `/v1/shops/query` body stage 0 sends.
 *
 * `mainMarketCountries` rather than `marketCountries`, and that is not a
 * preference — see `stage0.ts`, which explains what the looser one lets through.
 */
export interface ShopQuery {
  sortBy?: string;
  order?: "asc" | "desc";
  offset?: number;
  limit?: number;
  minMonthlyVisits?: number;
  minActiveAds?: number;
  adsTimePeriod?: "last24h" | "last7d" | "last30d";
  minProductsCount?: number;
  mainMarketCountries?: string[];
  trafficGrowth?: GrowthCondition[];
  search?: string;
  searchType?: "domain" | "productName" | "shopContains";
}

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

export class TrendTrackError extends Error {
  override readonly name = "TrendTrackError";
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Credits spent, counted the way TrendTrack bills rather than the way calls feel.
 *
 * Reported with every stage-0 result because the operator is spending a monthly
 * allowance and a run that silently costs 600 of 10,000 is a run they should be
 * able to see the price of. `rows` and `details` are kept apart so the expensive
 * half is obvious.
 */
export interface CreditLedger {
  /** Rows returned by search calls — one credit each. */
  rows: number;
  /** Detail calls — one credit each, flat. */
  details: number;
  /** Calls that returned nothing billable, kept for the record. */
  free: number;
}

export function emptyLedger(): CreditLedger {
  return { rows: 0, details: 0, free: 0 };
}

export function ledgerTotal(ledger: CreditLedger): number {
  return ledger.rows + ledger.details;
}

/** What stage 0 needs from TrendTrack. The seam is what lets the pipeline be tested. */
export interface TrendTrackClient {
  queryShops(
    query: ShopQuery,
    signal?: AbortSignal,
  ): Promise<{ data: ShopSummary[]; pagination: Pagination }>;
  getShop(shopId: string, signal?: AbortSignal): Promise<ShopDetail>;
  /** Free. Returns the credit balance so a run can refuse to start rather than half-finish. */
  getUsage(signal?: AbortSignal): Promise<{ remaining: number; limit: number; used: number }>;
  readonly ledger: CreditLedger;
}

export class HttpTrendTrackClient implements TrendTrackClient {
  readonly ledger = emptyLedger();

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutSeconds: number;

  constructor(options: { apiKey: string; baseUrl?: string; timeoutSeconds?: number }) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? TRENDTRACK_BASE_URL).replace(/\/$/, "");
    this.timeoutSeconds = options.timeoutSeconds ?? 60;
  }

  async queryShops(
    query: ShopQuery,
    signal?: AbortSignal,
  ): Promise<{ data: ShopSummary[]; pagination: Pagination }> {
    const body = await this.call<{ data?: ShopSummary[]; pagination?: Pagination }>(
      "/v1/shops/query",
      { method: "POST", body: JSON.stringify(query) },
      signal,
    );
    const data = body.data ?? [];
    // Billed on what came back, not on what was asked for.
    this.ledger.rows += data.length;
    return {
      data,
      pagination: body.pagination ?? { limit: query.limit ?? 0, offset: query.offset ?? 0, total: data.length },
    };
  }

  /**
   * One shop's detail. Retried on 429, unlike a search.
   *
   * The asymmetry is about billing, not about importance. A 429 is a refusal:
   * nothing came back, so nothing was charged, and asking again is free. A
   * *search* that is retried after a partial success would be paid for twice
   * at one credit per row, which is why `queryShops` has no retry at all.
   */
  async getShop(shopId: string, signal?: AbortSignal): Promise<ShopDetail> {
    const body = await this.retryOn429(
      () =>
        this.call<{ data?: ShopDetail }>(
          `/v1/shops/${encodeURIComponent(shopId)}`,
          { method: "GET" },
          signal,
        ),
      signal,
    );
    this.ledger.details += 1;
    if (!body.data) throw new TrendTrackError(`shop ${shopId} returned no data`, 200);
    return body.data;
  }

  /**
   * Retry a refused call with widening backoff.
   *
   * Jittered, because a pool of workers that all back off by the same amount
   * comes back in the same instant and is refused again for the same reason.
   */
  private async retryOn429<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        return await work();
      } catch (error) {
        lastError = error;
        const is429 = error instanceof TrendTrackError && error.status === 429;
        if (!is429 || attempt === RETRY_ATTEMPTS || signal?.aborted) break;
        const backoff = 250 * 2 ** (attempt - 1) + Math.random() * 250;
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
    throw lastError;
  }

  async getUsage(signal?: AbortSignal): Promise<{ remaining: number; limit: number; used: number }> {
    const body = await this.call<{
      includedQuota?: { limit?: number; used?: number; remaining?: number };
      credits?: { totalRemaining?: number };
    }>("/v1/usage", { method: "GET" }, signal);
    this.ledger.free += 1;
    const quota = body.includedQuota ?? {};
    return {
      // `totalRemaining` includes purchased top-ups; the quota block alone
      // understates what is actually spendable.
      remaining: body.credits?.totalRemaining ?? quota.remaining ?? 0,
      limit: quota.limit ?? 0,
      used: quota.used ?? 0,
    };
  }

  private async call<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
    if (!this.apiKey) {
      throw new TrendTrackError("TRENDTRACK_API_KEY is not set — stage 0 cannot run", 0);
    }
    const response = await fetchWithTimeout(
      `${this.baseUrl}${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
      },
      this.timeoutSeconds,
      signal,
    );
    const payload = (await response.json().catch(() => null)) as any;
    if (!response.ok) {
      const detail = payload?.error?.message ?? payload?.message ?? "no body";
      throw new TrendTrackError(
        `TrendTrack ${path} returned ${response.status}: ${String(detail).slice(0, 300)}`,
        response.status,
      );
    }
    if (payload == null) {
      throw new TrendTrackError(`TrendTrack ${path} returned a body that is not JSON`, response.status);
    }
    return payload as T;
  }
}
