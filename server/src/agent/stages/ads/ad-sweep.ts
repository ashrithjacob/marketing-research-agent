import type { AdHit, AdLibrary, AdQuery, AdSort } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";

export interface SweepPlan {
  domains: readonly string[];
  ingredientTerms: readonly string[];
  problemPhrases: readonly string[];
  countries: readonly string[];
}

export interface SweepLimits {
  maxAds: number;
  minCopyChars: number;
  maxAdsPerBrand: number;
}

/** Collects long-form image ads from an ad library: each competitor's own ads first, then ads naming the key active, then ads naming the problem in the buyer's words, both by longest running and by 7-day reach growth (TrendTrack refuses the 30-day sort), until the cap. The per-brand cap is kept here: TrendTrack refuses `maxAdsPerBrand` above 1 (measured 2026-10-19). */
export class AdSweep {
  static readonly PAGE_SIZE = 20;
  static readonly SORTS: readonly AdSort[] = ["longestRunning", "reachDelta7d"];

  constructor(
    private readonly ads: AdLibrary,
    private readonly limits: SweepLimits,
  ) {}

  async sweep(plan: SweepPlan, signal?: AbortSignal): Promise<AdHit[]> {
    Trace.line(import.meta.url, "AdSweep.sweep", { domains: plan.domains.length, ingredients: plan.ingredientTerms.length, problems: plan.problemPhrases.length });
    const found = new Map<string, AdHit>();
    const perBrand = new Map<string, number>();
    const queries = [
      ...plan.domains.map((domain) => ({ terms: [domain], searchIn: "domain" as const })),
      ...plan.ingredientTerms.map((term) => ({ terms: [term], searchIn: "ad_copy" as const })),
      ...plan.problemPhrases.map((phrase) => ({ terms: [phrase], searchIn: "ad_copy" as const })),
    ];
    for (const query of queries) {
      for (const sortBy of AdSweep.SORTS) {
        if (found.size >= this.limits.maxAds || signal?.aborted) return [...found.values()];
        const page = await this.ads.search(this.query(query.terms, query.searchIn, plan.countries, sortBy, found.size), signal);
        for (const hit of page.hits) this.keep(hit, found, perBrand);
      }
    }
    return [...found.values()];
  }

  private keep(hit: AdHit, found: Map<string, AdHit>, perBrand: Map<string, number>): void {
    Trace.tick(import.meta.url, "AdSweep.keep");
    const brand = (hit.landing_domain || hit.advertiser).replace(/^www\./, "").toLowerCase();
    const held = perBrand.get(brand) ?? 0;
    if (found.has(hit.ad_id) || hit.body.length < this.limits.minCopyChars || found.size >= this.limits.maxAds || held >= this.limits.maxAdsPerBrand) return;
    found.set(hit.ad_id, hit);
    perBrand.set(brand, held + 1);
  }

  private query(terms: string[], searchIn: AdQuery["searchIn"], countries: readonly string[], sortBy: AdSort, held: number): AdQuery {
    Trace.line(import.meta.url, "AdSweep.query", { terms, searchIn, sortBy });
    return {
      terms,
      searchIn,
      countries,
      sortBy,
      limit: Math.min(AdSweep.PAGE_SIZE, this.limits.maxAds - held),
      longForm: { minCopyChars: this.limits.minCopyChars },
    };
  }
}
