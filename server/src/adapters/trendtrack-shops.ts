import { Clock, type ShopIntel, type ShopSignals, type ShopTraction } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { TrendtrackApi } from "./trendtrack-api.js";

interface TrendtrackShop {
  catalog?: { productsCount?: number };
  sales?: { estMonthlySales?: number; estMonthlySalesMin?: number; estMonthlySalesMax?: number; unitsSold?: number } | null;
  traffic?: { monthlyVisits?: number; growth30d?: number };
  advertising?: { activeAds?: number };
}

/** TrendTrack's shops: `GET /v1/lookup` (free) finds a shop by its exact domain; `GET /v1/shops/{id}` and one page of `/products?sortBy=popularity` give its sales and a product's best-seller rank (4 credits each, measured 2026-10-19). */
export class TrendtrackShops implements ShopIntel {
  static readonly RANK_WINDOW = 30;

  constructor(private readonly api: TrendtrackApi) {}

  async lookup(domain: string, signal?: AbortSignal): Promise<ShopSignals | null> {
    Trace.line(import.meta.url, "TrendtrackShops.lookup", { domain });
    const { body } = await this.api.get(`/v1/lookup?${new URLSearchParams({ q: domain, type: "shop", limit: "1" })}`, signal);
    const match = (body as { data?: Array<{ matchType?: string; matchField?: string; shop?: { id?: string }; signals?: { monthlyVisits?: number; activeAds?: number } }> }).data?.[0];
    if (!match?.shop?.id || match.matchType !== "exact" || match.matchField !== "domain") return null;
    return { domain, shop_id: match.shop.id, monthly_visits: match.signals?.monthlyVisits ?? null, active_ads: match.signals?.activeAds ?? null };
  }

  async traction(signals: ShopSignals, productHandle: string | null, signal?: AbortSignal): Promise<{ traction: ShopTraction; credits: number }> {
    Trace.line(import.meta.url, "TrendtrackShops.traction", { shop: signals.shop_id, productHandle });
    const shop = await this.api.get(`/v1/shops/${signals.shop_id}`, signal);
    const data = ((shop.body as { data?: TrendtrackShop }).data ?? shop.body) as TrendtrackShop;
    const count = data.catalog?.productsCount ?? null;
    const ranked = count !== null && count > 1 && productHandle ? await this.rank(signals.shop_id, productHandle, signal) : { rank: null, credits: 0, listed: 0 };
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
        ranked_within: count === 1 ? 1 : ranked.listed,
        single_product: count === 1,
        fetched_at: Clock.nowIso(),
      },
    };
  }

  private async rank(shopId: string, handle: string, signal?: AbortSignal): Promise<{ rank: number | null; credits: number; listed: number }> {
    Trace.line(import.meta.url, "TrendtrackShops.rank", { shopId, handle });
    const page = await this.api.get(`/v1/shops/${shopId}/products?${new URLSearchParams({ sortBy: "popularity", limit: String(TrendtrackShops.RANK_WINDOW) })}`, signal);
    const rows = (page.body as { data?: Array<{ handle?: string; rank?: number }> }).data ?? [];
    const row = rows.find((product) => decodeURIComponent(product.handle ?? "").toLowerCase() === handle);
    return { rank: row?.rank ?? null, credits: page.credits, listed: rows.length };
  }
}
