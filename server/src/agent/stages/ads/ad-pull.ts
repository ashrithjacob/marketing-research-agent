import { AD_RINGS, AdRings, type AdLibrary, type AdRing, type Competitor, type Product, type PulledAd } from "../../../domain/index.js";
import type { ServicePrices } from "../../../config/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import type { AdPullRules } from "../../tools/pull-ads-tool.js";

import { RingScout } from "./ring-scout.js";

export interface RingOutcome {
  ring: AdRing;
  quota: number;
  kept: number;
  status: string;
  shortfall: string | null;
}

/** The pool: one scout per ring, all at once, each with its share of the total; an ad two scouts kept stays in the ring listed first (AD_RINGS), the closer to the client's product. */
export class AdPull {
  constructor(
    private readonly scout: RingScout,
    private readonly total: number,
  ) {}

  static withRules(ads: AdLibrary, prices: ServicePrices, rules: AdPullRules, total: number): AdPull {
    Trace.line(import.meta.url, "AdPull.withRules", { total });
    return new AdPull(new RingScout(ads, prices, rules), total);
  }

  async pull(context: RunContext, product: Product, competitors: readonly Competitor[]): Promise<{ pulled: PulledAd[]; outcomes: RingOutcome[] }> {
    Trace.line(import.meta.url, "AdPull.pull", { total: this.total });
    const quotas = AdRings.quotas(this.total);
    const results = await Promise.all(AD_RINGS.map((ring) => this.scout.pull(context, ring, quotas[ring], product, competitors)));
    const pulled = AdPull.merge(results.map((r) => r.pulled));
    const outcomes = AD_RINGS.map((ring, i) => ({
      ring,
      quota: quotas[ring],
      kept: pulled.filter((ad) => ad.ring === ring).length,
      status: results[i]!.result.status,
      shortfall: results[i]!.result.status === "completed" ? results[i]!.result.value.shortfall : null,
    }));
    return { pulled, outcomes };
  }

  static merge(byRing: readonly (readonly PulledAd[])[]): PulledAd[] {
    Trace.line(import.meta.url, "AdPull.merge", { rings: byRing.length });
    const kept = new Map<string, PulledAd>();
    for (const ads of byRing) for (const ad of ads) if (!kept.has(ad.hit.ad_id)) kept.set(ad.hit.ad_id, ad);
    return [...kept.values()];
  }
}
