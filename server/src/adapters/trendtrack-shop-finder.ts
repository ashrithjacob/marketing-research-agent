import type { FoundShop, ShopFinder, ShopPage, ShopQuery, ShopSearchField } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { TrendtrackApi } from "./trendtrack-api.js";

interface TrendtrackShopRow {
  domain?: string;
  name?: string;
  catalog?: { mainCategory?: string; bestSellers?: Array<{ title?: string }> };
  traffic?: { monthlyVisits?: number; growth30d?: number };
  sales?: { estMonthlySales?: number } | null;
  advertising?: { activeAds?: number };
}

/** TrendTrack's trending shops feed through `POST /v1/shops/query` with `displayInTrending`, 4 credits per shop returned (measured 2026-10-20). Active ads are counted over the last 7 days. */
export class TrendtrackShopFinder implements ShopFinder {
  private static readonly SEARCH_TYPE: Readonly<Record<ShopSearchField, string>> = { product_text: "productName", site_text: "shopContains" };

  constructor(private readonly api: TrendtrackApi) {}

  async find(query: ShopQuery, signal?: AbortSignal): Promise<ShopPage> {
    Trace.line(import.meta.url, "TrendtrackShopFinder.find", { text: query.text, sortBy: query.sortBy });
    const text = query.text?.trim() ? { search: query.text.trim(), searchType: TrendtrackShopFinder.SEARCH_TYPE[query.searchIn] } : {};
    const { body, credits } = await this.api.post(
      "/v1/shops/query",
      { ...text, displayInTrending: true, mainMarketCountries: [...query.countries], sortBy: query.sortBy, order: "desc", adsTimePeriod: "last7d", minActiveAds: query.minActiveAds, limit: query.limit, offset: 0 },
      signal,
    );
    const payload = body as { data?: TrendtrackShopRow[]; pagination?: { total?: number } };
    const shops = (payload.data ?? []).filter((row) => row.domain).map(TrendtrackShopFinder.shop);
    return { shops, total: Number(payload.pagination?.total ?? shops.length), credits };
  }

  private static shop(row: TrendtrackShopRow): FoundShop {
    Trace.tick(import.meta.url, "TrendtrackShopFinder.shop");
    return {
      domain: row.domain!,
      name: row.name ?? row.domain!,
      main_category: row.catalog?.mainCategory ?? null,
      monthly_visits: row.traffic?.monthlyVisits ?? null,
      visits_growth_30d: row.traffic?.growth30d ?? null,
      monthly_sales_usd: row.sales?.estMonthlySales ?? null,
      active_ads: row.advertising?.activeAds ?? null,
      best_sellers: (row.catalog?.bestSellers ?? []).map((item) => item.title ?? "").filter((title) => title !== "").slice(0, 3),
    };
  }
}
