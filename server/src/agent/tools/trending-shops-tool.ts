import type { AgentTool } from "@earendil-works/pi-agent-core";

import { SHOP_SORTS, type FoundShop, type ShopFinder, type ShopSort } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { EXTERNAL_NOTE } from "../prompt/text/external.js";
import type { ScoutLog } from "../stages/ads/scout-log.js";

import { trendingShopsParameters } from "./tool-parameters.js";

/** Lists shops on TrendTrack's trending feed in the run's markets, within the scout's search budget, so the scout can then search their long-form ads by domain. */
export class TrendingShopsTool {
  static readonly DEFAULT_MIN_ADS = 20;

  constructor(
    private readonly shops: ShopFinder,
    private readonly countries: readonly string[],
    private readonly log: ScoutLog,
  ) {}

  tool(): AgentTool<typeof trendingShopsParameters> {
    Trace.line(import.meta.url, "TrendingShopsTool.tool");
    const self = this;
    return {
      name: "find_trending_shops",
      label: "Find trending shops",
      description: "List shops on TrendTrack's trending feed in the run's markets: what they sell, estimated monthly sales, traffic and its growth, and Meta ads running over the last 7 days. It returns shops, not ads: search_ads with search_in domain shows a shop's long-form ads. Every shop returned is billed and uses one of your searches.",
      parameters: trendingShopsParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "TrendingShopsTool.tool.execute", { query: params.query, sortBy: params.sort_by });
        if (!(SHOP_SORTS as readonly string[]).includes(params.sort_by)) {
          return { content: [{ type: "text", text: `sort_by ${params.sort_by} is not one this tool accepts; use one of ${SHOP_SORTS.join(", ")}.` }], details: { refused: true } };
        }
        if (self.log.searchesLeft <= 0) {
          return { content: [{ type: "text", text: `Your search budget (${self.log.budget}) is spent. Use read_ad on ads you have seen, then submit.` }], details: { refused: true } };
        }
        const limit = Math.min(Math.max(Math.trunc(params.limit ?? 5), 1), 10);
        const minActiveAds = Math.max(0, Math.trunc(params.min_active_ads ?? TrendingShopsTool.DEFAULT_MIN_ADS));
        const page = await self.shops.find({ text: params.query ?? null, searchIn: params.search_in ?? "product_text", countries: self.countries, sortBy: params.sort_by as ShopSort, minActiveAds, limit }, signal);
        self.log.recordShops(page.shops);
        const head = `${page.total} trending shops match; ${page.shops.length} shown. ${self.log.searchesLeft} searches left.`;
        return { content: [{ type: "text", text: [head, ...page.shops.map(TrendingShopsTool.row), EXTERNAL_NOTE].join("\n\n") }], details: { total: page.total, shown: page.shops.length } };
      },
    };
  }

  static row(shop: FoundShop): string {
    Trace.tick(import.meta.url, "TrendingShopsTool.row");
    const sales = shop.monthly_sales_usd !== null ? `$${Math.round(shop.monthly_sales_usd).toLocaleString("en-US")}/mo sales` : "sales unknown";
    const growth = shop.visits_growth_30d !== null ? `, ${shop.visits_growth_30d >= 0 ? "+" : ""}${Math.round(shop.visits_growth_30d * 100)}% in 30 days` : "";
    const sellers = shop.best_sellers.length > 0 ? `\n   best sellers: ${shop.best_sellers.join("; ")}` : "";
    return `${shop.domain} (${shop.name}) | ${shop.main_category ?? "category unknown"} | ${sales} | ${shop.monthly_visits ?? "?"} visits/mo${growth} | ${shop.active_ads ?? "?"} active ads${sellers}`;
  }
}
