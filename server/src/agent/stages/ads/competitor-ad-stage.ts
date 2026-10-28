import type { ServicePrices } from "../../../config/index.js";
import { CompetitorRelationship, Markets, PAGE_KINDS, type AdLibrary, type PageKind, type Product, type StageName, type StoredAd } from "../../../domain/index.js";
import { AdScripts } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import type { Stage, StageInput, StageOutcome } from "../../pipeline/stage.js";

import { AdPull, type RingOutcome } from "./ad-pull.js";
import { AdReader } from "./ad-reader.js";
import { AudienceSegmenter } from "./audience-segmenter.js";
import { PageSorter } from "./page-sorter.js";

export interface AdPoolLimits {
  total: number;
  minCopyChars: number;
  minDaysRunning: number;
}

/** Stage 3: four agents, one per ring, pull the market's running long-form ads doing well, each its share of the pool; an agent reads one ad of each distinct script for its avatar and claim, the reading is copied to the script's other ads, another tags each advertiser page brand, community, persona or authority, and per market the copies are sorted into audience segments named from those readings; the page counts what the ads say from these. */
export class CompetitorAdStage implements Stage {
  readonly name: StageName = "competitor_ads";
  static readonly BATCH = 8;

  constructor(
    private readonly ads: AdLibrary | null,
    private readonly prices: ServicePrices,
    private readonly limits: AdPoolLimits,
    private readonly reader = new AdReader(),
    private readonly pages = new PageSorter(),
    private readonly audiences = new AudienceSegmenter(),
    private readonly concurrency = 3,
  ) {}

  async run(input: StageInput): Promise<StageOutcome> {
    Trace.line(import.meta.url, "CompetitorAdStage.run", { runId: input.context.run.id });
    if (!this.ads) return { status: "failed", summary: "", error: "TRENDTRACK_API_KEY is not set, so no ads can be searched" };
    const { context } = input;
    const product = (await context.store.products.get(input.product.id))!;
    const competitors = (await context.store.competitors.list(product.id)).filter((c) => c.status === "confirmed");
    await context.store.ads.clear(context.run.id);
    const rules = { countries: Markets.countries(context.run.input.markets), minCopyChars: this.limits.minCopyChars, minDaysRunning: this.limits.minDaysRunning };
    const { pulled, outcomes } = await AdPull.withRules(this.ads, this.prices, rules, this.limits.total).pull(context, product, competitors);
    const rings = CompetitorAdStage.rings(outcomes);
    if (pulled.length === 0) return { status: "invalid", summary: rings, error: "no ring kept any ads" };
    const byDomain = new Map(competitors.map((c) => [CompetitorRelationship.domainOf(c.url), c.id]));
    const stored = await context.store.ads.save(context.run.account_id, context.run.id, product.id, pulled, byDomain);
    const scripts = AdScripts.group(stored);
    const [unread, sorted] = await Promise.all([this.readAll(context, product, scripts), this.pages.sort(context, stored)]);
    await context.store.ads.setPageKinds(context.run.id, sorted.kinds);
    const segmented = await this.audiences.segment(context, await context.store.ads.list(context.run.id));
    await context.store.ads.setSegments(segmented.segmentByAd);
    const pooled = `${stored.length} ads pulled (${rings}), ${scripts.length} distinct scripts; ${stored.length - unread} read; ${CompetitorAdStage.pageKinds(sorted.kinds, sorted.unsorted)}; ${segmented.segments} audience segments`;
    if (unread === stored.length) return { status: "invalid", summary: `${pooled}.`, error: "no batch of ads could be read" };
    if (sorted.unsorted > 0) return { status: "invalid", summary: `${pooled}.`, error: `the page sorter could not sort ${sorted.unsorted} pages; their ads have no page kind` };
    if (segmented.unsorted > 0) return { status: "invalid", summary: `${pooled}.`, error: `${segmented.unsorted} ads could not be sorted into an audience segment` };
    return { status: "completed", summary: `${pooled}.`, error: "" };
  }

  /** Ads this run already kept that land on an added competitor's site become that competitor's; no new search is made. The page counts competitors when it loads, so the analysis needs no rerun. */
  async add(input: StageInput): Promise<string> {
    Trace.line(import.meta.url, "CompetitorAdStage.add", { runId: input.context.run.id, competitors: input.competitors.length });
    const linked = await input.context.store.ads.link(input.context.run.id, new Map(input.competitors.map((c) => [CompetitorRelationship.domainOf(c.url), c.id])));
    return `${linked} ads already kept land on their sites`;
  }

  static rings(outcomes: readonly RingOutcome[]): string {
    Trace.line(import.meta.url, "CompetitorAdStage.rings", { rings: outcomes.length });
    return outcomes.map((o) => `${o.ring} ${o.kept} of ${o.quota}${o.status === "completed" ? "" : ` (${o.status})`}`).join(", ");
  }

  static pageKinds(kinds: ReadonlyMap<string, PageKind>, unsorted: number): string {
    Trace.line(import.meta.url, "CompetitorAdStage.pageKinds", { pages: kinds.size, unsorted });
    const count = (kind: PageKind) => [...kinds.values()].filter((k) => k === kind).length;
    return `pages: ${PAGE_KINDS.map((kind) => `${count(kind)} ${kind}`).join(", ")}${unsorted > 0 ? `, ${unsorted} unsorted` : ""}`;
  }

  private async readAll(context: RunContext, product: Product, scripts: readonly StoredAd[][]): Promise<number> {
    Trace.line(import.meta.url, "CompetitorAdStage.readAll", { scripts: scripts.length });
    const members = new Map(scripts.map((script) => [script[0]!.id, script]));
    const firsts = scripts.map((script) => script[0]!);
    const batches = Array.from({ length: Math.ceil(firsts.length / CompetitorAdStage.BATCH) }, (_, i) => firsts.slice(i * CompetitorAdStage.BATCH, (i + 1) * CompetitorAdStage.BATCH));
    let unread = 0;
    let number = 0;
    const worker = async (): Promise<void> => {
      for (let batch = batches.shift(); batch && !context.signal.aborted; batch = batches.shift()) {
        const result = await this.reader.read(context, product, batch, ++number);
        if (result.status !== "completed") {
          unread += batch.reduce((sum, ad) => sum + members.get(ad.id)!.length, 0);
          continue;
        }
        for (const reading of result.value.ads) {
          for (const ad of members.get(reading.ad_id)!) await context.store.ads.saveReading(ad.id, { ...reading, ad_id: ad.id });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, batches.length) }, worker));
    return unread;
  }
}
