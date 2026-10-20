import type { AdHit, FoundShop } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";

/** What the scout has seen: every ad its searches returned, by TrendTrack id, the trending shops it looked at, and how much of its search budget is spent; a shop search spends it as an ad search does. */
export class ScoutLog {
  private readonly seen = new Map<string, AdHit>();
  private searches = 0;
  private rows = 0;
  private readonly shops = new Map<string, FoundShop>();

  constructor(readonly budget: number) {}

  get searchesLeft(): number {
    Trace.line(import.meta.url, "ScoutLog.searchesLeft", { searches: this.searches });
    return this.budget - this.searches;
  }

  get returned(): number {
    Trace.line(import.meta.url, "ScoutLog.returned", { rows: this.rows });
    return this.rows;
  }

  get searched(): number {
    Trace.line(import.meta.url, "ScoutLog.searched", { searches: this.searches });
    return this.searches;
  }

  record(hits: readonly AdHit[]): void {
    Trace.line(import.meta.url, "ScoutLog.record", { hits: hits.length });
    this.searches += 1;
    this.rows += hits.length;
    for (const hit of hits) this.seen.set(hit.ad_id, hit);
  }

  recordShops(shops: readonly FoundShop[]): void {
    Trace.line(import.meta.url, "ScoutLog.recordShops", { shops: shops.length });
    this.searches += 1;
    for (const shop of shops) this.shops.set(shop.domain, shop);
  }

  get shopsSeen(): number {
    Trace.line(import.meta.url, "ScoutLog.shopsSeen", { shops: this.shops.size });
    return this.shops.size;
  }

  ad(adId: string): AdHit | undefined {
    Trace.line(import.meta.url, "ScoutLog.ad", { adId });
    return this.seen.get(adId);
  }
}
