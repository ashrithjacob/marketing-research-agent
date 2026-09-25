import type { AgentTool } from "@earendil-works/pi-agent-core";

import {
  ActorRunners,
  AmazonProducts,
  AmazonReviews,
  MeteredActorRunner,
  TrustpilotReviews,
  type ActorCharge,
  type ActorRunner,
} from "../../adapters/apify/index.js";
import { Corpus } from "../../adapters/corpus.js";
import { Firecrawl } from "../../adapters/firecrawl.js";
import { OpenRouterGate } from "../../adapters/fetch-gate.js";
import { Searxng } from "../../adapters/searxng.js";
import type { Settings } from "../../config/index.js";

import type { FetchRecord, PacketCheckOptions } from "./lanes.js";
import { MineReviewsTool } from "./mine-reviews-tool.js";
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
  onApifyCharge?: (charge: ActorCharge) => void;
  actorRunner?: ActorRunner | null;
  reviewTools?: boolean;
  productSearch?: boolean;
  subject?: string;
  market?: string;
}

/** The tools one run gets; without an Apify runner the review tools are withheld, not stubbed. */
export class ResearchToolset {
  constructor(private readonly options: ToolsetOptions) {}

  build(): AgentTool<any>[] {
    const { settings, runId, onFetch } = this.options;
    const reviews = this.options.reviewTools !== false;
    const bare =
      reviews || this.options.productSearch
        ? (this.options.actorRunner ?? ActorRunners.forSettings(settings))
        : null;
    const onCharge = this.options.onApifyCharge;
    const runner = bare && onCharge ? new MeteredActorRunner(bare, onCharge) : bare;
    const gate = settings.gateModel ? new OpenRouterGate(settings) : undefined;

    const web = [
      new WebSearchTool(new Searxng(settings)).tool(),
      new WebFetchTool(
        settings,
        new Firecrawl(settings),
        new Corpus(settings.corpusPath),
        runId,
        onFetch,
        gate,
        this.options.subject,
        this.options.market,
      ).tool(),
    ];
    const check = this.options.packetCheck
      ? [new PacketCheckTool(this.options.packetCheck).tool()]
      : [];

    if (!runner) return [...web, ...check];

    const findProduct = new FindProductTool(new AmazonProducts(runner)).tool();
    if (!reviews) return [...web, findProduct, ...check];

    const amazon = new AmazonReviews(runner);
    const trustpilot = new TrustpilotReviews(runner);
    return [
      ...web,
      findProduct,
      new MineReviewsTool(settings, amazon, trustpilot, runId, onFetch).tool(),
      new AmazonReviewsTool(settings, amazon, runId, onFetch).tool(),
      new TrustpilotReviewsTool(settings, trustpilot, runId, onFetch).tool(),
      ...check,
    ];
  }
}
