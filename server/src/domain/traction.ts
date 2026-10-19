import { Trace } from "../trace/index.js";

/** What TrendTrack's free lookup says about a shop: enough to order a list, not to size it. */
export interface ShopSignals {
  domain: string;
  shop_id: string;
  monthly_visits: number | null;
  active_ads: number | null;
}

/** A shop's traction from TrendTrack's sales tracker, and where one product sits in the shop's best-seller order. Sales are for the whole shop: there is no per-product figure (measured 2026-10-19). */
export interface ShopTraction {
  shop_id: string;
  domain: string;
  monthly_sales_usd: number | null;
  monthly_sales_min_usd: number | null;
  monthly_sales_max_usd: number | null;
  units_sold: number | null;
  monthly_visits: number | null;
  visits_growth_30d: number | null;
  active_ads: number | null;
  products_count: number | null;
  product_rank: number | null;
  /** How many of the shop's best-sellers TrendTrack listed; 0 when it has no list for the shop, so the rank is unknown rather than low. */
  ranked_within: number;
  single_product: boolean;
  fetched_at: string;
}

export class ShopHandles {
  static fromUrl(url: string): string | null {
    Trace.line(import.meta.url, "ShopHandles.fromUrl", { url });
    try {
      const handle = /\/products\/([^/?#]+)/.exec(new URL(url).pathname)?.[1];
      return handle ? decodeURIComponent(handle).toLowerCase() : null;
    } catch {
      return null;
    }
  }
}
