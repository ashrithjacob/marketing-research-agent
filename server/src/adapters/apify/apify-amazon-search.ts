import type { ActorRunner, MarketplaceListing, MarketplaceSearch } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ActorResult } from "./actor-result.js";

/** Amazon search results through `apt_marble/amazon-search-results-scraper`, $0.0006 a result (2026-10-20): titles, ratings, organic rank, sponsored flagged. No bullet points. */
export class ApifyAmazonSearch implements MarketplaceSearch {
  static readonly ACTOR = "apt_marble/amazon-search-results-scraper";

  constructor(private readonly runner: ActorRunner) {}

  async search(keywords: readonly string[], marketplace: string, perKeyword: number, signal?: AbortSignal): Promise<MarketplaceListing[]> {
    Trace.line(import.meta.url, "ApifyAmazonSearch.search", { keywords, marketplace, perKeyword });
    const limits = { maxTotalChargeUsd: Math.max(0.1, keywords.length * perKeyword * 0.0006 * 2), timeoutSeconds: 600, memoryMb: 512 };
    const run = await this.runner.run(ApifyAmazonSearch.ACTOR, { keywords: [...keywords], maxResultsPerKeyword: perKeyword, marketplace, sortBy: "relevance" }, limits, signal);
    return ActorResult.items(run, ApifyAmazonSearch.ACTOR)
      .filter((row) => typeof row.asin === "string" && typeof row.title === "string")
      .map((row) => ({
        asin: String(row.asin),
        title: String(row.title),
        url: typeof row.url === "string" ? row.url : `https://www.amazon.com/dp/${String(row.asin)}`,
        keyword: String(row.keyword ?? ""),
        rating: ActorResult.number(row.rating),
        ratings_count: ActorResult.number(row.ratingsCount),
        price: ActorResult.number(row.price),
        sponsored: row.isSponsored === true,
        organic_position: ActorResult.number(row.organicPosition),
      }));
  }
}
