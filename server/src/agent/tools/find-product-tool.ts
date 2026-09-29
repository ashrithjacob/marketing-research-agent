import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { AmazonProducts } from "../../adapters/apify/index.js";

import { findProductParameters } from "./parameters.js";
import { Trace } from "../../trace/index.js";

export class FindProductTool {
  constructor(private readonly products: AmazonProducts) {}

  tool(): AgentTool<typeof findProductParameters> {
    Trace.line(import.meta.url, "FindProductTool.tool");
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
        Trace.line(import.meta.url, "FindProductTool.tool.execute", { params });
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
