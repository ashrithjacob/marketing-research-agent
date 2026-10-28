import type { AdCategoryPage, AdHit, AdLibrary, AdPage, AdQuery, AdSearchField } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { TrendtrackApi } from "./trendtrack-api.js";

interface TrendtrackAd {
  id?: string;
  status?: string;
  firstSeenAt?: string;
  lastSeenAt?: string | null;
  daysRunning?: number;
  media?: { type?: string; thumbnailUrl?: string; mediaUrl?: string };
  advertiser?: { name?: string; facebookPageId?: string; reach30d?: number; liveAdsCount?: number };
  content?: { body?: string; title?: string; landingPageUrl?: string; landingPageDomain?: string };
  metrics?: { reach?: number; duplicates?: number; reachDelta7d?: number; reachDelta30d?: number };
  audience?: { targetedCountries?: string[]; ageMin?: number; ageMax?: number; gender?: string };
  rank?: { currentRank?: number };
  flags?: { isEuAd?: boolean };
}

/** Trendtrack's index of Meta ads, `POST /v1/ads/query`; one credit per ad returned. No key, a refused key or no credit means it can answer nothing. */
export class TrendtrackAds implements AdLibrary {
  private static readonly SEARCH_TYPE: Readonly<Record<AdSearchField, string>> = { ad_copy: "adCopy", brand: "brand", domain: "domain" };
  static readonly CATEGORY_LIMIT = 15;

  constructor(private readonly api: TrendtrackApi) {}

  async search(query: AdQuery, signal?: AbortSignal): Promise<AdPage> {
    Trace.line(import.meta.url, "TrendtrackAds.search", { terms: query.terms, searchIn: query.searchIn, countries: query.countries });
    const { body, credits } = await this.api.post("/v1/ads/query", TrendtrackAds.body(query), signal);
    const payload = body as { data?: TrendtrackAd[]; pagination?: { total?: number } };
    const hits = (payload.data ?? []).map(TrendtrackAds.hit);
    return { hits, total: Number(payload.pagination?.total ?? payload.data?.length ?? 0), credits: credits > 0 ? credits : hits.length };
  }

  async categories(search: string, signal?: AbortSignal): Promise<AdCategoryPage> {
    Trace.line(import.meta.url, "TrendtrackAds.categories", { search });
    const { body, credits } = await this.api.get(`/v1/facets/categories?${new URLSearchParams({ search, limit: String(TrendtrackAds.CATEGORY_LIMIT) })}`, signal);
    const rows = ((body as { data?: { id?: number; name?: string; path?: string; usageCount?: number }[] }).data ?? []).filter((row) => typeof row.id === "number");
    return { categories: rows.map((row) => ({ id: row.id!, name: String(row.name ?? ""), path: String(row.path ?? row.name ?? ""), ads: row.usageCount ?? null })), credits };
  }

  static body(query: AdQuery): Record<string, unknown> {
    Trace.line(import.meta.url, "TrendtrackAds.body", { terms: query.terms.length });
    const audience = query.audience ?? {};
    return {
      ...(query.terms.length > 0 ? { search: [...query.terms], searchType: TrendtrackAds.SEARCH_TYPE[query.searchIn], keywordMode: query.keywordMode ?? "any" } : {}),
      sortBy: query.sortBy ?? "reach",
      order: "desc",
      status: query.activeOnly ? "active" : "all",
      platforms: ["facebook"],
      ...(query.countries.length > 0 ? { adCountries: { include: [...query.countries] } } : {}),
      ...(query.longForm ? { mediaType: "image", minDescriptionLength: query.longForm.minCopyChars } : {}),
      ...(query.minDaysRunning !== undefined ? { minDaysRunning: query.minDaysRunning } : {}),
      ...(query.minDuplicates !== undefined ? { minDuplicates: query.minDuplicates } : {}),
      ...(query.categoryIds && query.categoryIds.length > 0 ? { categoryIds: [...query.categoryIds] } : {}),
      ...(audience.minAge !== undefined ? { minAge: audience.minAge } : {}),
      ...(audience.maxAge !== undefined ? { maxAge: audience.maxAge } : {}),
      ...(audience.sex ? { sex: audience.sex } : {}),
      ...(query.onePerBrand ? { maxAdsPerBrand: 1 } : {}),
      ...(query.page ? { page: query.page } : {}),
      ...(query.createdAfter ? { createdAfter: query.createdAfter } : {}),
      ...(query.createdBefore ? { createdBefore: query.createdBefore } : {}),
      limit: query.limit,
    };
  }

  private static hit(ad: TrendtrackAd): AdHit {
    Trace.tick(import.meta.url, "TrendtrackAds.hit", {});
    return {
      ad_id: String(ad.id ?? ""),
      advertiser: String(ad.advertiser?.name ?? ""),
      page_id: String(ad.advertiser?.facebookPageId ?? ""),
      landing_url: String(ad.content?.landingPageUrl ?? ""),
      landing_domain: String(ad.content?.landingPageDomain ?? ""),
      first_seen: String(ad.firstSeenAt ?? "").slice(0, 10),
      last_seen: String(ad.lastSeenAt ?? "").slice(0, 10),
      status: String(ad.status ?? ""),
      countries: ad.audience?.targetedCountries ?? [],
      body: [ad.content?.title, ad.content?.body].filter(Boolean).join("\n"),
      ad_reach: ad.metrics?.reach ?? null,
      page_reach_30d: ad.advertiser?.reach30d ?? null,
      page_live_ads: ad.advertiser?.liveAdsCount ?? null,
      days_running: ad.daysRunning ?? null,
      duplicates: ad.metrics?.duplicates ?? null,
      reach_delta_7d: ad.metrics?.reachDelta7d ?? null,
      reach_delta_30d: ad.metrics?.reachDelta30d ?? null,
      current_rank: ad.rank?.currentRank ?? null,
      is_eu: ad.flags?.isEuAd ?? false,
      media_url: ad.media?.mediaUrl || null,
      thumbnail_url: ad.media?.thumbnailUrl || null,
      age_min: ad.audience?.ageMin ?? null,
      age_max: ad.audience?.ageMax ?? null,
      gender: ad.audience?.gender ?? null,
    };
  }
}
