import { CompetitorRelationship, ShopHandles, type Resolution, type ShopIntel, type ShopSignalCache } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Looks up, for free, the TrendTrack shop of every proposed Shopify product page, so the user can see which competitors draw the most visitors before choosing; a marketplace listing is not a shop and is skipped. */
export class ResolutionSignals {
  constructor(
    private readonly shops: ShopIntel | null,
    private readonly cache: ShopSignalCache,
  ) {}

  async collect(resolution: Resolution, signal: AbortSignal): Promise<number> {
    Trace.line(import.meta.url, "ResolutionSignals.collect", { competitors: resolution.competitors.length });
    if (!this.shops) return 0;
    const urls = [resolution.product.url, ...resolution.competitors.map((c) => c.url)].filter((url) => ShopHandles.fromUrl(url) !== null);
    const domains = [...new Set(urls.map((url) => CompetitorRelationship.domainOf(url)))];
    const held = await this.cache.get(domains);
    let found = held.size;
    for (const domain of domains.filter((d) => !held.has(d))) {
      if (signal.aborted) break;
      const signals = await this.shops.lookup(domain, signal).catch(() => null);
      if (signals) {
        await this.cache.put(signals);
        found += 1;
      }
    }
    return found;
  }
}
