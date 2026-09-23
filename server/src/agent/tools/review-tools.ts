import type { AgentTool } from "@earendil-works/pi-agent-core";

import {
  AmazonProducts,
  AmazonReviews,
  TrustpilotReviews,
  type ActorRunner,
} from "../../adapters/apify/index.js";
import type { Settings } from "../../config/index.js";

import type { FetchRecord } from "./lanes.js";
import {
  amazonReviewParameters,
  findProductParameters,
  trustpilotReviewParameters,
} from "./parameters.js";
import { ReviewRendering } from "./review-rendering.js";

export class FindProductTool {
  constructor(private readonly products: AmazonProducts) {}

  tool(): AgentTool<typeof findProductParameters> {
    const products = this.products;
    return {
      name: "amazon_find_product",
      label: "Find product on Amazon",
      description:
        "Search Amazon by product name and get back asin, title, stars and " +
        "reviewsCount, most-reviewed first. Use this before amazon_reviews — it " +
        "takes a url, not a name. Pick the product by reviewsCount: a listing " +
        "with four reviews cannot support a review-mining node.",
      parameters: findProductParameters,
      async execute(_id, params, signal) {
        const max = Math.min(Math.max(Math.trunc(params.max_results ?? 5), 1), 20);
        const found = await products.find({ query: params.query, maxResults: max, signal });
        if (found.length === 0) {
          return {
            content: [
              { type: "text", text: `No Amazon products found for ${JSON.stringify(params.query)}.` },
            ],
            details: { query: params.query, products: [] },
          };
        }
        const rendered = found
          .map(
            (product) =>
              `${product.asin}  ${product.stars ?? "?"}*  reviews=${product.reviewsCount ?? "?"}\n` +
              `   ${product.title}\n   ${product.url}`,
          )
          .join("\n\n");
        return {
          content: [{ type: "text", text: rendered }],
          details: { query: params.query, products: found },
        };
      },
    };
  }
}

export class AmazonReviewsTool {
  constructor(
    private readonly settings: Settings,
    private readonly reviews: AmazonReviews,
    private readonly runId: string,
    private readonly onFetch?: (record: FetchRecord) => void,
  ) {}

  tool(): AgentTool<typeof amazonReviewParameters> {
    const { settings, reviews, runId, onFetch } = this;
    return {
      name: "amazon_reviews",
      label: "Amazon reviews",
      description:
        "Fetch verbatim Amazon reviews for ONE product url, optionally at one " +
        "star band. Returns text, star, date and a locator, archived and hashed " +
        "like web_fetch. Call it once per star band to cover 1-5; 3 is " +
        "mandatory. If it reports a GAP, record the gap — never substitute " +
        "another band.",
      parameters: amazonReviewParameters,
      async execute(_id, params, signal) {
        const limit = ReviewRendering.limit(params.max_reviews, settings.apifyMaxReviews);
        const result = await reviews.fetch({
          productUrl: params.product_url,
          star: ReviewRendering.starBand(params.star),
          maxReviews: limit,
          signal,
        });
        return ReviewRendering.render(
          settings,
          runId,
          params.product_url,
          result,
          onFetch,
          ReviewRendering.cappedNote(params.max_reviews, limit),
        );
      },
    };
  }
}

export class TrustpilotReviewsTool {
  constructor(
    private readonly settings: Settings,
    private readonly reviews: TrustpilotReviews,
    private readonly runId: string,
    private readonly onFetch?: (record: FetchRecord) => void,
  ) {}

  tool(): AgentTool<typeof trustpilotReviewParameters> {
    const { settings, reviews, runId, onFetch } = this;
    return {
      name: "trustpilot_reviews",
      label: "Trustpilot reviews",
      description:
        "Fetch verbatim Trustpilot reviews for ONE company domain, optionally at " +
        "one star band. These review the MERCHANT — delivery, support, ordering " +
        "— not the product, so they are review_platform sources and answer " +
        "why_quit far better than why_bought. Do not use them to fill the " +
        "marketplace-review floor.",
      parameters: trustpilotReviewParameters,
      async execute(_id, params, signal) {
        const limit = ReviewRendering.limit(params.max_reviews, settings.apifyMaxReviews);
        const result = await reviews.fetch({
          domainOrUrl: params.domain,
          star: ReviewRendering.starBand(params.star),
          maxItems: limit,
          signal,
        });
        return ReviewRendering.render(
          settings,
          runId,
          params.domain,
          result,
          onFetch,
          ReviewRendering.cappedNote(params.max_reviews, limit),
        );
      },
    };
  }
}
