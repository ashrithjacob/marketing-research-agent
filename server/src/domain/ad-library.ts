export const AD_SEARCH_FIELDS = ["ad_copy", "brand", "domain"] as const;
export type AdSearchField = (typeof AD_SEARCH_FIELDS)[number];

/** The sorts TrendTrack's ads query accepts with our filters, measured 2026-10-19; its docs also list reachDelta30d and reachDelta1d, which the API refuses (400 unsupported_filter). */
export const AD_SORTS = ["reach", "newest", "longestRunning", "reachDelta7d", "mostDuplicates", "rankDelta30d"] as const;
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
  /** At most one ad per advertiser page. TrendTrack's `maxAdsPerBrand` accepts only 1 (400 unsupported_filter otherwise, measured 2026-10-19), so a cap above one is kept by the caller, never asked of the library. */
  onePerBrand?: boolean;
  /** Only ads first seen inside this window, ISO dates; with TrendTrack's `status: all` this reaches ads long stopped. */
  createdAfter?: string;
  createdBefore?: string;
  /** Only ads still running; otherwise running and stopped alike. */
  activeOnly?: boolean;
  minDaysRunning?: number;
  minDuplicates?: number;
  /** TrendTrack category ids (Google's product taxonomy), matched against the advertiser's shop. */
  categoryIds?: readonly number[];
  /** The ad's targeted audience, as Meta reports it. */
  audience?: AdAudienceFilter;
  /** How several terms combine: any one of them, or all of them. */
  keywordMode?: AdKeywordMode;
}

export const AD_KEYWORD_MODES = ["any", "all"] as const;
export type AdKeywordMode = (typeof AD_KEYWORD_MODES)[number];

export const AD_SEXES = ["men", "women"] as const;
export type AdSex = (typeof AD_SEXES)[number];

export interface AdAudienceFilter {
  minAge?: number;
  maxAge?: number;
  sex?: AdSex;
}

/** One category an ad search can be narrowed to, and how many of the library's ads carry it. */
export interface AdCategory {
  id: number;
  name: string;
  path: string;
  ads: number | null;
}

export interface AdCategoryPage {
  categories: AdCategory[];
  credits: number;
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
  age_min: number | null;
  age_max: number | null;
  gender: string | null;
}

export interface AdPage {
  hits: AdHit[];
  total: number;
  /** Credits the request used, as the service's own header reports them. */
  credits?: number;
}
