export const AD_SEARCH_FIELDS = ["ad_copy", "brand", "domain"] as const;
export type AdSearchField = (typeof AD_SEARCH_FIELDS)[number];

export const AD_SORTS = ["reach", "newest", "longestRunning", "reachDelta30d"] as const;
export type AdSort = (typeof AD_SORTS)[number];

export interface AdQuery {
  terms: readonly string[];
  searchIn: AdSearchField;
  countries: readonly string[];
  limit: number;
  page?: number;
  sortBy?: AdSort;
  /** Long-form statics only: image ads whose copy is at least this many characters. */
  longForm?: { minCopyChars: number };
}

/** One Meta ad as an ad library indexed it: who ran it, where it sends people, when it ran, what it says. */
export interface AdHit {
  ad_id: string;
  advertiser: string;
  page_id: string;
  landing_url: string;
  landing_domain: string;
  first_seen: string;
  last_seen: string;
  status: string;
  countries: string[];
  body: string;
  ad_reach: number | null;
  page_reach_30d: number | null;
  page_live_ads: number | null;
  days_running: number | null;
  duplicates: number | null;
  reach_delta_7d: number | null;
  reach_delta_30d: number | null;
  current_rank: number | null;
  is_eu: boolean;
  media_url: string | null;
  thumbnail_url: string | null;
}

export interface AdPage {
  hits: AdHit[];
  total: number;
  /** Credits the request used, as the service's own header reports them. */
  credits?: number;
}
