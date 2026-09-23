import { AMAZON_SEARCH_ACTOR, Spend } from "./actors.js";
import { Field } from "./fields.js";
import type { ActorRunner } from "./runner.js";
import type { AmazonProduct } from "./types.js";

/** A brief names a product; the reviews actor takes a url. This is the link. */
export class AmazonProducts {
  constructor(private readonly runner: ActorRunner) {}

  async find(options: { query: string; maxResults: number; marketplace?: string; signal?: AbortSignal },
  ): Promise<AmazonProduct[]> {
    const host = options.marketplace ?? "www.amazon.com";
    const searchUrl = `https://${host}/s?k=${encodeURIComponent(options.query)}`;
    const { status, items } = await this.runner.run(
      AMAZON_SEARCH_ACTOR,
      {
        categoryUrls: [{ url: searchUrl }],
        maxItemsPerStartUrl: options.maxResults,
        maxSearchPagesPerStartUrl: 1,
        scrapeProductDetails: false,
      },
      Spend.capFor(AMAZON_SEARCH_ACTOR, options.maxResults),
      options.signal,
    );

    if (items.length === 0) {
      throw new Error(
        `Apify run for ${AMAZON_SEARCH_ACTOR} finished ${status} with an empty dataset ` +
          `(query ${JSON.stringify(options.query)}). That is a failed lookup, not proof ` +
          "that Amazon has no such product — check the run in the Apify console.",
      );
    }

    const products: AmazonProduct[] = [];
    for (const item of items) {
      const asin = Field.text(item.asin);
      if (!asin) continue;
      products.push({
        asin,
        title: Field.text(item.title),
        stars: Field.numberOrNull(item.stars),
        reviewsCount: Field.numberOrNull(item.reviewsCount),
        url: Field.text(item.url) || `https://${host}/dp/${asin}`,
      });
    }
    products.sort((a, b) => (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0));
    return products;
  }
}
