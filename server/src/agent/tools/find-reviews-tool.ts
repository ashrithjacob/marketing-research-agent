import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { StoredReview } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { MarketLog } from "../stages/market/market-log.js";

import { findReviewsParameters } from "./market-tool-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** Stored reviews containing a phrase, the client's and competitors': how buyers arrived ("my doctor recommended"), what they tried, how skeptical they were. Free. */
export class FindReviewsTool {
  static readonly NAME = "find_reviews";
  static readonly SHOWN = 15;

  constructor(
    private readonly reviews: readonly StoredReview[],
    private readonly log: MarketLog,
  ) {}

  tool(): AgentTool<typeof findReviewsParameters> {
    Trace.line(import.meta.url, "FindReviewsTool.tool", { reviews: this.reviews.length });
    const self = this;
    return {
      name: FindReviewsTool.NAME,
      label: "Find reviews by phrase",
      description: `Up to ${FindReviewsTool.SHOWN} stored reviews containing a phrase, lowest rating first, each with its id. Free.`,
      parameters: findReviewsParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "FindReviewsTool.tool.execute", { phrase: params.phrase });
        if (!self.log.spend(FindReviewsTool.NAME)) return ToolReply.refused("You have searched the reviews enough; label what you found.");
        const phrase = params.phrase.toLowerCase();
        const matches = self.reviews.filter((review) => `${review.title} ${review.body}`.toLowerCase().includes(phrase));
        const shown = [...matches].sort((a, b) => a.rating - b.rating).slice(0, FindReviewsTool.SHOWN);
        for (const review of shown) self.log.add({ id: review.id, kind: "review", text: `${review.rating}★ ${review.title ? `${review.title}. ` : ""}${review.body}`, url: null, brand: null, date: review.review_date, days_running: null, active: null, volume: null }, "");
        if (shown.length === 0) return ToolReply.text(`No stored review contains "${params.phrase}".`);
        return ToolReply.external([`${matches.length} reviews contain "${params.phrase}"; ${shown.length} shown.`, ...shown.map((review) => `[${review.id}] ${review.rating}★ "${ToolReply.clip(`${review.title} ${review.body}`, 260)}"`)], { matches: matches.length });
      },
    };
  }
}
