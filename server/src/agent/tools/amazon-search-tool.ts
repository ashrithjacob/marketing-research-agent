import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { MarketplaceSearch } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { MarketLog } from "../stages/market/market-log.js";

import { amazonSearchParameters } from "./market-tool-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** The top Amazon listings for a buyer's search: how crowded and inflated the claims in titles are. Paid through Apify, cents a call. */
export class AmazonSearchTool {
  static readonly NAME = "search_amazon";
  static readonly PER_KEYWORD = 30;

  constructor(
    private readonly marketplace: MarketplaceSearch,
    private readonly market: string | null,
    private readonly log: MarketLog,
  ) {}

  tool(): AgentTool<typeof amazonSearchParameters> {
    Trace.line(import.meta.url, "AmazonSearchTool.tool");
    const self = this;
    return {
      name: AmazonSearchTool.NAME,
      label: "Amazon search results",
      description: `The top ${AmazonSearchTool.PER_KEYWORD} Amazon listings for each of 1 to 3 searches: title, rating, number of ratings, price, organic position, sponsored or not. Paid and limited.`,
      parameters: amazonSearchParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "AmazonSearchTool.tool.execute", { keywords: params.keywords });
        if (!self.market) return ToolReply.refused("Amazon search is not available for this run's market.");
        const keywords = params.keywords.slice(0, 3);
        if (keywords.length === 0) return ToolReply.refused("Give at least one search.");
        if (!self.log.spend(AmazonSearchTool.NAME)) return ToolReply.refused("Your Amazon searches are spent.");
        const listings = await self.marketplace.search(keywords, self.market, AmazonSearchTool.PER_KEYWORD, signal);
        const items = listings.map((listing) =>
          self.log.add({ kind: "amazon_listing", text: listing.title, url: listing.url, brand: null, date: null, days_running: null, active: null, volume: listing.ratings_count }, "al-"),
        );
        const rows = listings.map((listing, i) => `[${items[i]!.id}] ${listing.sponsored ? "sponsored" : `#${listing.organic_position ?? "?"}`} | ${listing.rating ?? "?"}★ (${listing.ratings_count ?? "?"}) | ${listing.price ?? "?"} | ${ToolReply.clip(listing.title, 180)}`);
        return ToolReply.external([`${listings.length} listings for ${keywords.join(", ")}. ${self.log.left(AmazonSearchTool.NAME)} Amazon searches left.`, ...rows], { listings: listings.length });
      },
    };
  }
}
