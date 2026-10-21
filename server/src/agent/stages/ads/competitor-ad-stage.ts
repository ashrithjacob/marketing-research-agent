import type { AdLibrary, AdRing, Product, ReadAd, ShopFinder, StageName, StoredAd } from "../../../domain/index.js";
import { CompetitorRelationship } from "../../../domain/index.js";
import type { ServicePrices } from "../../../config/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import type { Stage, StageInput, StageOutcome } from "../../pipeline/stage.js";

import { AdReader } from "./ad-reader.js";
import { AdScout, type ScoutLimits } from "./ad-scout.js";

/** Stage 3: a scout agent studies the market's long-form ads in a growth marketer's rings and keeps the ones worth studying; each kept ad is then read for its avatar, claim, awareness and bucket. */
export class CompetitorAdStage implements Stage {
  readonly name: StageName = "competitor_ads";
  static readonly BATCH = 8;

  constructor(
    private readonly ads: AdLibrary | null,
    private readonly shops: ShopFinder | null,
    private readonly prices: ServicePrices,
    private readonly limits: ScoutLimits,
    private readonly reader = new AdReader(),
    private readonly concurrency = 3,
  ) {}

  async run(input: StageInput): Promise<StageOutcome> {
    Trace.line(import.meta.url, "CompetitorAdStage.run", { runId: input.context.run.id });
    if (!this.ads) return { status: "failed", summary: "", error: "TRENDTRACK_API_KEY is not set, so no ads can be searched" };
    const { context } = input;
    const product = (await context.store.products.get(input.product.id))!;
    const competitors = (await context.store.competitors.list(product.id)).filter((c) => c.status === "confirmed");
    await context.store.ads.clear(context.run.id);
    const { result, log } = await new AdScout(this.ads, this.shops, this.prices, this.limits).scout(context, product, competitors);
    if (result.status !== "completed") {
      const why = result.status === "invalid" ? result.problems.join("; ") : result.status === "failed" ? result.error : "stopped";
      return { status: result.status === "invalid" ? "invalid" : "failed", summary: `${log.searched} searches, ${log.returned} ads returned`, error: `scout: ${why}` };
    }
    const report = result.value;
    const byDomain = new Map(competitors.map((c) => [CompetitorRelationship.domainOf(c.url), c.id]));
    const stored = await context.store.ads.save(context.run.account_id, context.run.id, product.id, report.kept.map((kept) => log.ad(kept.ad_id)!), byDomain);
    const ringOf = new Map(report.kept.map((kept) => [kept.ad_id, kept]));
    for (const ad of stored) await context.store.ads.saveRing(ad.id, ringOf.get(ad.trendtrack_ad_id)!.ring, ringOf.get(ad.trendtrack_ad_id)!.why);
    await context.emit("ads.brands", { brands: report.brands });
    const unread = await this.readAll(context, product, stored);
    const summary = `${stored.length} ads kept of ${log.returned} seen in ${log.searched} searches (${log.shopsSeen} trending shops looked at), from ${report.brands.length} brands; ${CompetitorAdStage.rings(await context.store.ads.list(context.run.id))}; ${stored.length - unread} read.`;
    if (stored.length > 0 && unread === stored.length) return { status: "invalid", summary, error: "no batch of ads could be read" };
    return { status: "completed", summary, error: "" };
  }

  /** Ads this run already kept that land on an added competitor's site become that competitor's; no new search is made. */
  async add(input: StageInput): Promise<string> {
    Trace.line(import.meta.url, "CompetitorAdStage.add", { runId: input.context.run.id, competitors: input.competitors.length });
    const linked = await input.context.store.ads.link(input.context.run.id, new Map(input.competitors.map((c) => [CompetitorRelationship.domainOf(c.url), c.id])));
    return `${linked} ads already kept land on their sites`;
  }

  static rings(ads: readonly ReadAd[]): string {
    Trace.line(import.meta.url, "CompetitorAdStage.rings", { ads: ads.length });
    const count = (ring: AdRing) => ads.filter((ad) => ad.ring === ring).length;
    return `${count("direct_competitor")} direct competitor, ${count("same_problem")} same problem, ${count("same_buyer")} same buyer, ${count("trending_shop")} trending shop`;
  }

  private async readAll(context: RunContext, product: Product, ads: readonly StoredAd[]): Promise<number> {
    Trace.line(import.meta.url, "CompetitorAdStage.readAll", { ads: ads.length });
    const batches = Array.from({ length: Math.ceil(ads.length / CompetitorAdStage.BATCH) }, (_, i) => ads.slice(i * CompetitorAdStage.BATCH, (i + 1) * CompetitorAdStage.BATCH));
    let unread = 0;
    let number = 0;
    const worker = async (): Promise<void> => {
      for (let batch = batches.shift(); batch && !context.signal.aborted; batch = batches.shift()) {
        const result = await this.reader.read(context, product, batch, ++number);
        if (result.status !== "completed") {
          unread += batch.length;
          continue;
        }
        for (const reading of result.value.ads) await context.store.ads.saveReading(reading.ad_id, reading);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, batches.length) }, worker));
    return unread;
  }
}
