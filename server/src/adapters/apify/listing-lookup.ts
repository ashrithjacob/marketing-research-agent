import type { AmazonListing, AmazonListingSource, BestsellerRank } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { AMAZON_SEARCH_ACTOR, Spend } from "./actors.js";
import { Field } from "./fields.js";
import type { ActorRunner } from "./runner.js";

type Item = Record<string, unknown>;

/** The best-selling Amazon listing for a phrase, opened for its traction details: rank, sales, rating spread. */
export class AmazonListingLookup implements AmazonListingSource {
  constructor(private readonly runner: ActorRunner) {}

  async lookup(query: string, marketplace: string, max: number, signal?: AbortSignal): Promise<AmazonListing[]> {
    Trace.line(import.meta.url, "AmazonListingLookup.lookup", { query, marketplace, max });
    const { items } = await this.runner.run(
      AMAZON_SEARCH_ACTOR,
      {
        categoryUrls: [{ url: `https://${marketplace}/s?k=${encodeURIComponent(query)}` }],
        maxItemsPerStartUrl: max,
        maxSearchPagesPerStartUrl: 1,
        scrapeProductDetails: true,
      },
      Spend.capFor(AMAZON_SEARCH_ACTOR, max),
      signal,
    );
    return items.filter((item) => Field.text(item.asin)).map((item) => AmazonListingLookup.listing(item, marketplace));
  }

  private static listing(item: Item, marketplace: string): AmazonListing {
    Trace.line(import.meta.url, "AmazonListingLookup.listing", { asin: item.asin });
    const asin = Field.text(item.asin);
    const price = AmazonListingLookup.record(item.price);
    return {
      asin,
      title: Field.text(item.title),
      url: Field.text(item.url) || `https://${marketplace}/dp/${asin}`,
      brand: Field.text(item.brand),
      marketplace,
      price: Field.numberOrNull(price?.value),
      currency: Field.text(price?.currency),
      stars: Field.numberOrNull(item.stars),
      stars_breakdown: AmazonListingLookup.breakdown(item.starsBreakdown),
      reviews_count: Field.numberOrNull(item.reviewsCount),
      bought_past_month: Field.text(item.monthlyPurchaseVolume),
      bestseller_ranks: AmazonListingLookup.ranks(item.bestsellerRanks),
      amazon_choice: item.isAmazonChoice === true,
      thumbnail: Field.text(item.thumbnailImage),
    };
  }

  private static record(value: unknown): Item | null {
    Trace.tick(import.meta.url, "AmazonListingLookup.record", {});
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Item) : null;
  }

  private static breakdown(value: unknown): Record<string, number> | null {
    Trace.line(import.meta.url, "AmazonListingLookup.breakdown", { value });
    const raw = AmazonListingLookup.record(value);
    if (!raw) return null;
    const out: Record<string, number> = {};
    for (const star of [1, 2, 3, 4, 5]) {
      const share = Field.numberOrNull(raw[`${star}star`]);
      if (share !== null) out[String(star)] = share;
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  private static ranks(value: unknown): BestsellerRank[] {
    Trace.line(import.meta.url, "AmazonListingLookup.ranks", { value });
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      const row = AmazonListingLookup.record(entry);
      const rank = Field.numberOrNull(row?.rank);
      return row && rank !== null ? [{ rank, category: Field.text(row.category) }] : [];
    });
  }
}
