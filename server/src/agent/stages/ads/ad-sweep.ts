import type { AdHit, AdLibrary, AdQuery, AdSort } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";

export interface SweepPlan {
  domains: readonly string[];
  keywords: readonly string[];
  countries: readonly string[];
}

export interface SweepLimits {
  maxAds: number;
  minCopyChars: number;
  maxAdsPerBrand: number;
}

/** Collects long-form image ads from an ad library: each competitor's own ads first, then the category by keyword, both by longest running and by 30-day reach growth, until the cap. */
export class AdSweep {
  static readonly PAGE_SIZE = 20;
  static readonly SORTS: readonly AdSort[] = ["longestRunning", "reachDelta30d"];

  constructor(
    private readonly ads: AdLibrary,
    private readonly limits: SweepLimits,
  ) {}

  async sweep(plan: SweepPlan, signal?: AbortSignal): Promise<AdHit[]> {
    Trace.line(import.meta.url, "AdSweep.sweep", { domains: plan.domains.length, keywords: plan.keywords.length });
    const found = new Map<string, AdHit>();
    const queries = [
      ...plan.domains.map((domain) => ({ terms: [domain], searchIn: "domain" as const })),
      ...plan.keywords.map((keyword) => ({ terms: [keyword], searchIn: "ad_copy" as const })),
    ];
    for (const query of queries) {
      for (const sortBy of AdSweep.SORTS) {
        if (found.size >= this.limits.maxAds || signal?.aborted) return [...found.values()];
        const page = await this.ads.search(this.query(query.terms, query.searchIn, plan.countries, sortBy, found.size), signal);
        for (const hit of page.hits) if (hit.body.length >= this.limits.minCopyChars && found.size < this.limits.maxAds) found.set(hit.ad_id, hit);
      }
    }
    return [...found.values()];
  }

  private query(terms: string[], searchIn: AdQuery["searchIn"], countries: readonly string[], sortBy: AdSort, held: number): AdQuery {
    Trace.line(import.meta.url, "AdSweep.query", { terms, searchIn, sortBy });
    return {
      terms,
      searchIn,
      countries,
      sortBy,
      limit: Math.min(AdSweep.PAGE_SIZE, this.limits.maxAds - held),
      longForm: { minCopyChars: this.limits.minCopyChars, maxAdsPerBrand: this.limits.maxAdsPerBrand },
    };
  }
}
