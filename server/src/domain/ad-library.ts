export const AD_SEARCH_FIELDS = ["ad_copy", "brand", "domain"] as const;
export type AdSearchField = (typeof AD_SEARCH_FIELDS)[number];

export interface AdQuery {
  terms: readonly string[];
  searchIn: AdSearchField;
  countries: readonly string[];
  limit: number;
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
}

export interface AdPage {
  hits: AdHit[];
  total: number;
}
