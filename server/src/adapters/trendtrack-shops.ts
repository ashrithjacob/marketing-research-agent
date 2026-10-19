import type { Settings } from "../config/index.js";
import { Clock, ServiceUnavailableError, type ShopIntel, type ShopSignals, type ShopTraction } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";

interface TrendtrackShop {
  catalog?: { productsCount?: number };
  sales?: { estMonthlySales?: number; estMonthlySalesMin?: number; estMonthlySalesMax?: number; unitsSold?: number } | null;
  traffic?: { monthlyVisits?: number; growth30d?: number };
  advertising?: { activeAds?: number };
}

/** TrendTrack's shops: `GET /v1/lookup` (free) finds a shop by its exact domain; `GET /v1/shops/{id}` and one page of `/products?sortBy=popularity` give its sales and a product's best-seller rank (4 credits each, measured 2026-10-19). */
export class TrendtrackShops implements ShopIntel {
  static readonly RANK_WINDOW = 30;

  constructor(private readonly settings: Settings) {}

  async lookup(domain: string, signal?: AbortSignal): Promise<ShopSignals | null> {
    Trace.line(import.meta.url, "TrendtrackShops.lookup", { domain });
    const { body } = await this.get(`/v1/lookup?${new URLSearchParams({ q: domain, type: "shop", limit: "1" })}`, signal);
    const match = (body as { data?: Array<{ matchType?: string; matchField?: string; shop?: { id?: string }; signals?: { monthlyVisits?: number; activeAds?: number } }> }).data?.[0];
    if (!match?.shop?.id || match.matchType !== "exact" || match.matchField !== "domain") return null;
    return { domain, shop_id: match.shop.id, monthly_visits: match.signals?.monthlyVisits ?? null, active_ads: match.signals?.activeAds ?? null };
  }

  async traction(signals: ShopSignals, productHandle: string | null, signal?: AbortSignal): Promise<{ traction: ShopTraction; credits: number }> {
    Trace.line(import.meta.url, "TrendtrackShops.traction", { shop: signals.shop_id, productHandle });
    const shop = await this.get(`/v1/shops/${signals.shop_id}`, signal);
    const data = ((shop.body as { data?: TrendtrackShop }).data ?? shop.body) as TrendtrackShop;
    const count = data.catalog?.productsCount ?? null;
    const ranked = count !== null && count > 1 && productHandle ? await this.rank(signals.shop_id, productHandle, signal) : { rank: null, credits: 0 };
    return {
      credits: shop.credits + ranked.credits,
      traction: {
        shop_id: signals.shop_id,
        domain: signals.domain,
        monthly_sales_usd: data.sales?.estMonthlySales ?? null,
        monthly_sales_min_usd: data.sales?.estMonthlySalesMin ?? null,
        monthly_sales_max_usd: data.sales?.estMonthlySalesMax ?? null,
        units_sold: data.sales?.unitsSold ?? null,
        monthly_visits: data.traffic?.monthlyVisits ?? signals.monthly_visits,
        visits_growth_30d: data.traffic?.growth30d ?? null,
        active_ads: data.advertising?.activeAds ?? signals.active_ads,
        products_count: count,
        product_rank: count === 1 ? 1 : ranked.rank,
        ranked_within: count === 1 ? 1 : Math.min(count ?? 0, TrendtrackShops.RANK_WINDOW),
        single_product: count === 1,
        fetched_at: Clock.nowIso(),
      },
    };
  }

  private async rank(shopId: string, handle: string, signal?: AbortSignal): Promise<{ rank: number | null; credits: number }> {
    Trace.line(import.meta.url, "TrendtrackShops.rank", { shopId, handle });
    const page = await this.get(`/v1/shops/${shopId}/products?${new URLSearchParams({ sortBy: "popularity", limit: String(TrendtrackShops.RANK_WINDOW) })}`, signal);
    const rows = (page.body as { data?: Array<{ handle?: string; rank?: number }> }).data ?? [];
    const row = rows.find((product) => decodeURIComponent(product.handle ?? "").toLowerCase() === handle);
    return { rank: row?.rank ?? null, credits: page.credits };
  }

  private async get(path: string, signal?: AbortSignal): Promise<{ body: unknown; credits: number }> {
    Trace.line(import.meta.url, "TrendtrackShops.get", { path });
    const { trendtrackApiKey, trendtrackBaseUrl, webTimeoutSeconds } = this.settings;
    if (!trendtrackApiKey) throw new ServiceUnavailableError("trendtrack", "TRENDTRACK_API_KEY is not set");
    const response = await Http.withTimeout(`${trendtrackBaseUrl.replace(/\/$/, "")}${path}`, { headers: { Authorization: `Bearer ${trendtrackApiKey}` } }, webTimeoutSeconds, signal);
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
    const error = `Trendtrack returned ${response.status}: ${body.message ?? body.error?.message ?? "no body"}`.slice(0, 300);
    if (response.status === 401 || response.status === 402 || response.status === 403) throw new ServiceUnavailableError("trendtrack", error);
    if (!response.ok) throw new Error(error);
    const credits = Number(response.headers.get("x-credits-used") ?? 0);
    return { body, credits: Number.isFinite(credits) ? credits : 0 };
  }
}
