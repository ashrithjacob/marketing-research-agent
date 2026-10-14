import type { ServicePrices } from "../../config/index.js";
import type { AdHit, AdLibrary, ResearchStore, WatchedBrand } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { WorkspaceLimits } from "../always/workspace-limits.js";

import type { Watch } from "./watchers.js";

/** The competitor-ads watcher (spec §7.3): once a day, each watched brand's newest Meta ads through Trendtrack; ads first seen since the last check are signalled. The first check only sets the baseline. Trendtrack credits are charged to the workspace, and no check runs once today's spend reaches the daily cap. */
export class CompetitorAdsWatch implements Watch {
  readonly kind = "competitor_ads";
  static readonly DAY_MS = 86_400_000;
  static readonly LIMIT = 25;

  constructor(
    private readonly store: ResearchStore,
    private readonly ads: AdLibrary | null,
    private readonly prices: Pick<ServicePrices, "trendtrackUsdPerCredit">,
    private readonly limits: WorkspaceLimits,
    private readonly signal: (workspaceId: string, text: string, key: string) => Promise<void>,
  ) {}

  async check(workspaceId: string, now: number): Promise<number> {
    Trace.line(import.meta.url, "CompetitorAdsWatch.check", { workspaceId });
    const brands = await this.store.watch.brands(workspaceId);
    if (!this.ads || brands.length === 0 || (await this.limits.overCap(workspaceId))) return now + CompetitorAdsWatch.DAY_MS;
    const at = new Date(now).toISOString();
    const lines: string[] = [];
    for (const brand of brands.filter((b) => !b.checked_at || now - Date.parse(b.checked_at) >= CompetitorAdsWatch.DAY_MS - 60_000)) {
      const fresh = await this.newAds(workspaceId, brand);
      await this.store.watch.checked(brand.id, at);
      if (brand.checked_at && fresh.length > 0) lines.push(CompetitorAdsWatch.line(brand, fresh));
    }
    if (lines.length > 0) await this.signal(workspaceId, `Competitor ads: ${lines.join("; ")}.`, `competitor_ads:${at.slice(0, 10)}`);
    return now + CompetitorAdsWatch.DAY_MS;
  }

  private async newAds(workspaceId: string, brand: WatchedBrand): Promise<AdHit[]> {
    Trace.line(import.meta.url, "CompetitorAdsWatch.newAds", { brand: brand.id });
    const page = await this.ads!.search({ terms: [brand.term], searchIn: brand.search_in, countries: [], limit: CompetitorAdsWatch.LIMIT, sortBy: "newest" });
    const credits = page.credits ?? page.hits.length;
    await this.store.watch.charge(workspaceId, `watcher:${this.kind}`, { service: "trendtrack", item: "ads", units: credits, usd: credits * this.prices.trendtrackUsdPerCredit, basis: "credits" });
    const since = (brand.checked_at || brand.created_at).slice(0, 10);
    return page.hits.filter((hit) => hit.first_seen && hit.first_seen >= since);
  }

  static line(brand: WatchedBrand, fresh: readonly AdHit[]): string {
    Trace.line(import.meta.url, "CompetitorAdsWatch.line", { brand: brand.id, fresh: fresh.length });
    const first = fresh[0]!;
    const said = first.body.replace(/\s+/g, " ").slice(0, 100);
    return `${brand.term}: ${fresh.length} new ad${fresh.length === 1 ? "" : "s"} since ${(brand.checked_at || brand.created_at).slice(0, 10)}, e.g. "${said}"${first.landing_domain ? ` to ${first.landing_domain}` : ""}`;
  }
}
