import type { AgentTool } from "@earendil-works/pi-agent-core";

import { ApifyAmazonSearch, ApifyKeywordVolumes, ApifyRedditSearch, MeteredActorRunner, MeteredAdLibrary, MeteredPageFetcher } from "../../../adapters/index.js";
import type { ServicePrices } from "../../../config/index.js";
import { Markets, SOPHISTICATION_NAMES, SourceMarkets, type ActorRunner, type AdLibrary, type ChargeMeter, type PageArchive, type PageFetcher, type ReadAd, type SearchSuggestions, type StageName, type StoredReview } from "../../../domain/index.js";
import { MarketTally } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import type { Stage, StageInput, StageOutcome } from "../../pipeline/stage.js";
import { AdHistoryTool } from "../../tools/ad-history-tool.js";
import { AmazonSearchTool } from "../../tools/amazon-search-tool.js";
import { FindReviewsTool } from "../../tools/find-reviews-tool.js";
import { ListAdsTool } from "../../tools/list-ads-tool.js";
import { PageHistoryTool } from "../../tools/page-history-tool.js";
import { ReadLandingTool } from "../../tools/read-landing-tool.js";
import { ReadSnapshotTool } from "../../tools/read-snapshot-tool.js";
import { RedditTool } from "../../tools/reddit-tool.js";
import { SuggestionsTool } from "../../tools/suggestions-tool.js";
import { VolumeTool } from "../../tools/volume-tool.js";

import { MarketLog } from "./market-log.js";
import { MarketReader } from "./market-reader.js";

/** Where stage 4's evidence comes from: TrendTrack for ad history, a page reader for landing pages, the free search boxes and Wayback Machine, and Apify for volumes, Amazon and Reddit. */
export interface MarketSources {
  ads: AdLibrary | null;
  pages: PageFetcher;
  suggestions: SearchSuggestions;
  archive: PageArchive;
  actors: ActorRunner | null;
}

export interface MarketLimits {
  historySearches: number;
  paidCalls: number;
}

/** Stage 4: an agent reads the market's sophistication off stage 3's ads and the competitors' history, and labels buyer evidence by awareness on each channel; code counts the claims and the shares (docs/spec-stage4.md). */
export class MarketStage implements Stage {
  readonly name: StageName = "sophistication";

  constructor(
    private readonly sources: MarketSources,
    private readonly prices: ServicePrices,
    private readonly limits: MarketLimits,
    private readonly reader = new MarketReader(),
  ) {}

  async run(input: StageInput): Promise<StageOutcome> {
    Trace.line(import.meta.url, "MarketStage.run", { runId: input.context.run.id });
    const { context } = input;
    const product = (await context.store.products.get(input.product.id))!;
    const competitors = (await context.store.competitors.list(product.id)).filter((c) => c.status === "confirmed");
    const ads = (await context.store.ads.list(context.run.id)).filter((ad) => ad.reading !== null);
    const log = this.log(ads);
    const tools = this.tools(context, ads, await context.store.reviews.all(product.id), log);
    const result = await this.reader.read(context, product, competitors, tools, log, ads.length);
    if (result.status !== "completed") {
      const why = result.status === "invalid" ? result.problems.join("; ") : result.status === "failed" ? result.error : "stopped";
      return { status: result.status === "invalid" ? "invalid" : "failed", summary: "", error: `market reader: ${why}` };
    }
    const assessment = MarketTally.assessment(context.run.id, result.value, log.all, ads);
    await context.store.market.save(context.run.account_id, assessment);
    await context.emit("market.read", { stage: assessment.sophistication_stage, channels: assessment.awareness.map((channel) => channel.channel) });
    const brands = new Set(assessment.claims.flatMap((claim) => claim.brands)).size;
    const summary =
      `Sophistication stage ${assessment.sophistication_stage} of 5 (${SOPHISTICATION_NAMES[assessment.sophistication_stage]}), ${assessment.confidence} confidence, from ${assessment.claims.length} claims across ${brands} brands. ` +
      `Awareness measured on ${assessment.awareness.length} channels from ${result.value.labels.length} labelled items; ` +
      `${log.calls(AdHistoryTool.NAME)} ad history searches, ${log.calls(VolumeTool.NAME) + log.calls(AmazonSearchTool.NAME) + log.calls(RedditTool.NAME)} Apify calls.`;
    return { status: "completed", summary, error: "" };
  }

  private log(ads: readonly ReadAd[]): MarketLog {
    Trace.line(import.meta.url, "MarketStage.log", { ads: ads.length });
    const { historySearches, paidCalls } = this.limits;
    const log = new MarketLog({
      [AdHistoryTool.NAME]: historySearches,
      [VolumeTool.NAME]: paidCalls,
      [AmazonSearchTool.NAME]: paidCalls,
      [RedditTool.NAME]: paidCalls,
      [PageHistoryTool.NAME]: 6,
      [ReadSnapshotTool.NAME]: 12,
      [SuggestionsTool.NAME]: 20,
      [FindReviewsTool.NAME]: 20,
      [ReadLandingTool.NAME]: 6,
    });
    for (const ad of ads) {
      log.add({ id: ad.id, kind: "stage_ad", text: ad.copy, url: ad.landing_url || null, brand: (ad.landing_domain || ad.advertiser).replace(/^www\./, ""), date: ad.first_seen, days_running: ad.days_running, active: ad.status === "active", volume: null }, "");
    }
    return log;
  }

  private tools(context: RunContext, ads: readonly ReadAd[], reviews: readonly StoredReview[], log: MarketLog): AgentTool<any>[] {
    Trace.line(import.meta.url, "MarketStage.tools", { ads: ads.length });
    const meter: ChargeMeter = context.meter(MarketReader.AGENT_ID);
    const market = context.run.input.markets[0]!;
    const { sources, prices } = this;
    const tools: AgentTool<any>[] = [
      new ListAdsTool(ads, log).tool(),
      new PageHistoryTool(sources.archive, log).tool(),
      new ReadSnapshotTool(sources.archive, log).tool(),
      new SuggestionsTool(sources.suggestions, SourceMarkets.googleCountry(market), log).tool(),
      new FindReviewsTool(reviews, log).tool(),
      new ReadLandingTool(new MeteredPageFetcher(sources.pages, prices, meter), log).tool(),
    ];
    if (sources.ads) tools.push(new AdHistoryTool(new MeteredAdLibrary(sources.ads, prices, meter), Markets.countries(context.run.input.markets), log).tool());
    if (sources.actors) {
      const runner = new MeteredActorRunner(sources.actors, meter, context.billing.defer);
      tools.push(
        new VolumeTool(new ApifyKeywordVolumes(runner), SourceMarkets.keywordCountry(market), log).tool(),
        new AmazonSearchTool(new ApifyAmazonSearch(runner), SourceMarkets.amazonMarketplace(market), log).tool(),
        new RedditTool(new ApifyRedditSearch(runner), log).tool(),
      );
    }
    return tools;
  }
}
