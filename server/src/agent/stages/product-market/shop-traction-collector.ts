import { MeteredShopIntel } from "../../../adapters/index.js";
import type { ServicePrices } from "../../../config/index.js";
import { CompetitorRelationship, ShopHandles, type Competitor, type Product, type ShopIntel, type ShopTraction } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";

/** Fetches TrendTrack's sales record for the client's shop and each confirmed competitor's shop, with where the product sits in its shop's best-seller order; only Shopify product pages, each charged to the run. */
export class ShopTractionCollector {
  constructor(
    private readonly shops: ShopIntel | null,
    private readonly prices: ServicePrices,
    private readonly concurrency = 3,
  ) {}

  async collect(context: RunContext, product: Product, competitors: readonly Competitor[]): Promise<number> {
    Trace.line(import.meta.url, "ShopTractionCollector.collect", { competitors: competitors.length });
    if (!this.shops) return 0;
    const shops = new MeteredShopIntel(this.shops, this.prices, context.meter("shop_traction"));
    const jobs: Array<() => Promise<"found" | "none" | string>> = [
      () => this.one(context, shops, product.url, (traction) => context.store.products.saveTraction(product.id, traction)),
      ...competitors.map((c) => () => this.one(context, shops, c.url, (traction) => context.store.competitors.saveTraction(c.id, traction))),
    ];
    let found = 0;
    const failures: string[] = [];
    const worker = async (): Promise<void> => {
      for (let job = jobs.shift(); job && !context.signal.aborted; job = jobs.shift()) {
        const outcome = await job();
        if (outcome === "found") found += 1;
        else if (outcome !== "none") failures.push(outcome);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, jobs.length) }, worker));
    await context.emit("traction.collected", { found, of: competitors.length + 1, failures });
    return found;
  }

  private async one(context: RunContext, shops: ShopIntel, url: string, save: (traction: ShopTraction) => Promise<void>): Promise<"found" | "none" | string> {
    Trace.line(import.meta.url, "ShopTractionCollector.one", { url });
    const handle = ShopHandles.fromUrl(url);
    if (!handle) return "none";
    const domain = CompetitorRelationship.domainOf(url);
    try {
      const signals = (await context.store.signals.get([domain])).get(domain) ?? (await shops.lookup(domain, context.signal));
      if (!signals) return "none";
      await context.store.signals.put(signals);
      await save((await shops.traction(signals, handle, context.signal)).traction);
      return "found";
    } catch (error) {
      return `${domain}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
