import type { AgentTool } from "@earendil-works/pi-agent-core";

import {
  ActorRunners,
  AmazonProducts,
  AmazonReviews,
  TrustpilotReviews,
  type ActorRunner,
} from "../../adapters/apify/index.js";
import { Corpus } from "../../adapters/corpus.js";
import { Firecrawl } from "../../adapters/firecrawl.js";
import { Searxng } from "../../adapters/searxng.js";
import type { Settings } from "../../config/index.js";

import type { FetchRecord, PacketCheckOptions } from "./lanes.js";
import { PacketCheckTool } from "./packet-check-tool.js";
import {
  AmazonReviewsTool,
  FindProductTool,
  TrustpilotReviewsTool,
} from "./review-tools.js";
import { WebFetchTool, WebSearchTool } from "./web-tools.js";

export interface ToolsetOptions {
  settings: Settings;
  runId: string;
  packetCheck?: PacketCheckOptions;
  onFetch?: (record: FetchRecord) => void;
  actorRunner?: ActorRunner | null;
  reviewTools?: boolean;
  productSearch?: boolean;
}

/** The tools one run gets; without an Apify runner the review tools are withheld, not stubbed. */
export class ResearchToolset {
  constructor(private readonly options: ToolsetOptions) {}

  build(): AgentTool<any>[] {
    const { settings, runId, onFetch } = this.options;
    const reviews = this.options.reviewTools !== false;
    const runner =
      reviews || this.options.productSearch
        ? (this.options.actorRunner ?? ActorRunners.forSettings(settings))
        : null;

    const web = [
      new WebSearchTool(new Searxng(settings)).tool(),
      new WebFetchTool(
        settings,
        new Firecrawl(settings),
        new Corpus(settings.corpusPath),
        runId,
        onFetch,
      ).tool(),
    ];
    const check = this.options.packetCheck
      ? [new PacketCheckTool(this.options.packetCheck).tool()]
      : [];

    if (!runner) return [...web, ...check];

    const findProduct = new FindProductTool(new AmazonProducts(runner)).tool();
    if (!reviews) return [...web, findProduct, ...check];

    return [
      ...web,
      findProduct,
      new AmazonReviewsTool(settings, new AmazonReviews(runner), runId, onFetch).tool(),
      new TrustpilotReviewsTool(settings, new TrustpilotReviews(runner), runId, onFetch).tool(),
      ...check,
    ];
  }
}
