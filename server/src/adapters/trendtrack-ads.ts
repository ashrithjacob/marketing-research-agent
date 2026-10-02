import type { Settings } from "../config/index.js";
import { ServiceUnavailableError, type AdHit, type AdLibrary, type AdPage, type AdQuery, type AdSearchField } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";

interface TrendtrackAd {
  id?: string;
  status?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  advertiser?: { name?: string; facebookPageId?: string; reach30d?: number; liveAdsCount?: number };
  content?: { body?: string; title?: string; landingPageUrl?: string; landingPageDomain?: string };
  metrics?: { reach?: number };
  audience?: { targetedCountries?: string[] };
}

/** Trendtrack's index of Meta ads, `POST /v1/ads/query`; one credit per ad returned. No key, a refused key or no credit means it can answer nothing. */
export class TrendtrackAds implements AdLibrary {
  private static readonly SEARCH_TYPE: Readonly<Record<AdSearchField, string>> = { ad_copy: "adCopy", brand: "brand", domain: "domain" };

  constructor(private readonly settings: Settings) {}

  async search(query: AdQuery, signal?: AbortSignal): Promise<AdPage> {
    Trace.line(import.meta.url, "TrendtrackAds.search", { terms: query.terms, searchIn: query.searchIn, countries: query.countries });
    const { trendtrackApiKey, trendtrackBaseUrl, webTimeoutSeconds } = this.settings;
    if (!trendtrackApiKey) throw new ServiceUnavailableError("trendtrack", "TRENDTRACK_API_KEY is not set");
    const body = {
      search: [...query.terms],
      searchType: TrendtrackAds.SEARCH_TYPE[query.searchIn],
      keywordMode: "any",
      sortBy: "reach",
      order: "desc",
      status: "all",
      platforms: ["facebook"],
      ...(query.countries.length > 0 ? { adCountries: { include: [...query.countries] } } : {}),
      limit: query.limit,
    };
    const response = await Http.withTimeout(
      `${trendtrackBaseUrl.replace(/\/$/, "")}/v1/ads/query`,
      { method: "POST", headers: { Authorization: `Bearer ${trendtrackApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
      webTimeoutSeconds,
      signal,
    );
    const payload = (await response.json().catch(() => ({}))) as { data?: TrendtrackAd[]; pagination?: { total?: number }; message?: string; error?: unknown };
    const error = `Trendtrack returned ${response.status}: ${String(payload.message ?? JSON.stringify(payload.error ?? "no body"))}`.slice(0, 300);
    if (response.status === 401 || response.status === 402 || response.status === 403) throw new ServiceUnavailableError("trendtrack", error);
    if (!response.ok) throw new Error(error);
    return { hits: (payload.data ?? []).map(TrendtrackAds.hit), total: Number(payload.pagination?.total ?? payload.data?.length ?? 0) };
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
    };
  }
}
