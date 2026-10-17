import { AmazonListingSchema, Asins, type AmazonListing, type ReviewTarget } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AMAZON_LISTING_SYSTEM } from "../../prompt/text/amazon-listing.js";
import type { UrlLedger } from "../../tools/url-ledger.js";

/** Finds a product's own Amazon listing by searching; code accepts only a url the agent met in a search result, with a product code in it. */
export class AmazonListingFinder {
  static readonly MAX_TURNS = 6;

  async find(context: RunContext, target: ReviewTarget, brand: string): Promise<AgentResult<AmazonListing>> {
    Trace.line(import.meta.url, "AmazonListingFinder.find", { target: target.name });
    const agentId = `amazon_listing:${target.competitor_id ?? "client"}`;
    const { tools, urls } = context.kit(agentId, ["web_search"]);
    return context.agent({
      agentId,
      system: AMAZON_LISTING_SYSTEM,
      instructions: `Brand: ${brand}\nProduct: ${target.name}\nIts own page: ${target.url}`,
      tools,
      maxTurns: AmazonListingFinder.MAX_TURNS,
      submission: { schema: AmazonListingSchema, describe: "Hand back the Amazon listing, or null.", check: (listing) => AmazonListingFinder.problems(listing, urls) },
    });
  }

  static problems(listing: AmazonListing, urls: UrlLedger): string[] {
    Trace.line(import.meta.url, "AmazonListingFinder.problems");
    if (listing.amazon_url === null) return [];
    if (urls.unknown([listing.amazon_url]).length > 0) return [`${listing.amazon_url} did not appear in any search result; use a url exactly as a result gave it`];
    return Asins.fromUrl(listing.amazon_url) ? [] : [`${listing.amazon_url} is not an Amazon product page with /dp/ and a ten-character code`];
  }
}
