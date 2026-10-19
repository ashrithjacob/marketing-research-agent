import { MeteredAdLibrary } from "../../../adapters/index.js";
import type { ServicePrices } from "../../../config/index.js";
import { CompetitorRelationship, Markets, type AdLibrary, type Product, type StageName, type StoredAd } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import type { Stage, StageInput, StageOutcome } from "../../pipeline/stage.js";

import { AdKeywordsAgent } from "./ad-keywords-agent.js";
import { AdReader } from "./ad-reader.js";
import { AdStageSummary } from "./ad-stage-summary.js";
import { AdSweep, type SweepLimits, type SweepPage } from "./ad-sweep.js";

/** Stage 4: the market's long-form image ads, found by competitors' domains, the key active and the buyer's problem phrases, each read by an agent as a growth marketer would: which ring it belongs to (same problem, same buyer, unrelated) and how it is doing. */
export class CompetitorAdStage implements Stage {
  readonly name: StageName = "competitor_ads";
  static readonly BATCH = 8;

  constructor(
    private readonly ads: AdLibrary | null,
    private readonly prices: ServicePrices,
    private readonly limits: SweepLimits,
    private readonly keywords = new AdKeywordsAgent(),
    private readonly reader = new AdReader(),
    private readonly concurrency = 3,
  ) {}

  async run(input: StageInput): Promise<StageOutcome> {
    Trace.line(import.meta.url, "CompetitorAdStage.run", { runId: input.context.run.id });
    if (!this.ads) return { status: "failed", summary: "", error: "TRENDTRACK_API_KEY is not set, so no ads can be searched" };
    const { context } = input;
    const product = (await context.store.products.get(input.product.id))!;
    const competitors = (await context.store.competitors.list(product.id)).filter((c) => c.status === "confirmed");
    const picked = await this.keywords.pick(context, product);
    if (picked.status !== "completed") return { status: picked.status === "invalid" ? "invalid" : "failed", summary: "", error: `keywords: ${picked.status === "invalid" ? picked.problems.join("; ") : picked.status === "failed" ? picked.error : "stopped"}` };
    const sweep = new AdSweep(new MeteredAdLibrary(this.ads, this.prices, context.meter(this.name)), this.limits);
    const { ingredient_terms, problem_phrases } = picked.value;
    const plan = { domains: competitors.map((c) => c.domain), ingredientTerms: ingredient_terms, problemPhrases: problem_phrases, countries: Markets.countries(context.run.input.markets) };
    const pages: SweepPage[] = [];
    const hits = await sweep.sweep(plan, context.signal, (page) => {
      pages.push(page);
      void context.emit("ads.searched", { ...page });
    });
    const returned = pages.reduce((sum, page) => sum + page.returned, 0);
    const byDomain = new Map(competitors.map((c) => [CompetitorRelationship.domainOf(c.url), c.id]));
    const stored = await context.store.ads.save(context.run.account_id, product.id, hits, byDomain);
    const unread = await this.readAll(context, product, stored);
    const rings = AdStageSummary.rings(await context.store.ads.list(product.id));
    const summary = `${stored.length} long-form statics kept of ${returned} returned by ${pages.length} searches (${[...ingredient_terms, ...problem_phrases].join(", ")}); ${stored.length - unread} read: ${rings}.`;
    if (stored.length > 0 && unread === stored.length) return { status: "invalid", summary, error: "no batch of ads could be read" };
    return { status: "completed", summary: unread > 0 ? `${summary} ${unread} could not be read.` : summary, error: "" };
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
