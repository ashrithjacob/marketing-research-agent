export const SHOP_SORTS = ["estMonthlySales", "activeAds", "growth30d", "monthlyVisits"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];

export const SHOP_SEARCH_FIELDS = ["product_text", "site_text"] as const;
export type ShopSearchField = (typeof SHOP_SEARCH_FIELDS)[number];

/** A search of TrendTrack's trending shops feed in the run's markets; text is optional, and an empty one browses the whole feed. */
export interface ShopQuery {
  text: string | null;
  searchIn: ShopSearchField;
  countries: readonly string[];
  sortBy: ShopSort;
  minActiveAds: number;
  limit: number;
}

/** A trending shop as the feed describes it: what it sells, how big it is and how hard it is advertising. */
export interface FoundShop {
  domain: string;
  name: string;
  main_category: string | null;
  monthly_visits: number | null;
  visits_growth_30d: number | null;
  monthly_sales_usd: number | null;
  active_ads: number | null;
  best_sellers: string[];
}

export interface ShopPage {
  shops: FoundShop[];
  total: number;
  credits: number;
}
