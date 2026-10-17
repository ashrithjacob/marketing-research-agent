import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";

import type { StoredRunReview } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { EXTERNAL_REVIEWS_NOTE } from "../prompt/text/external.js";
import { READ_REVIEWS } from "../prompt/text/voice-tools.js";

export const readReviewsParameters = Type.Object({
  star: Type.Optional(Type.Number({ description: "Only reviews with this many stars, 1 to 5." })),
  page: Type.Optional(Type.Number({ description: "Which page, from 1." })),
});

/** The mined reviews, paged for a model to read: lowest stars first, each with the ref a quote cites. */
export class ReadReviewsTool {
  static readonly PAGE = 25;
  static readonly CHARS = 700;

  constructor(private readonly reviews: readonly StoredRunReview[]) {}

  tool(): AgentTool<typeof readReviewsParameters> {
    Trace.line(import.meta.url, "ReadReviewsTool.tool", { reviews: this.reviews.length });
    const reviews = this.reviews;
    return {
      name: READ_REVIEWS.name,
      label: "read reviews",
      description: READ_REVIEWS.description,
      parameters: readReviewsParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "ReadReviewsTool.tool.execute", { star: params.star, page: params.page });
        const kept = reviews.filter((r) => params.star === undefined || r.star === params.star).sort((a, b) => (a.star ?? 6) - (b.star ?? 6) || b.posted_at.localeCompare(a.posted_at));
        const pages = Math.max(1, Math.ceil(kept.length / ReadReviewsTool.PAGE));
        const page = Math.min(Math.max(1, Math.floor(params.page ?? 1)), pages);
        const shown = kept.slice((page - 1) * ReadReviewsTool.PAGE, page * ReadReviewsTool.PAGE).map(ReadReviewsTool.line);
        const header = `${kept.length} reviews${params.star === undefined ? "" : ` with ${params.star} stars`}; page ${page} of ${pages}`;
        return { content: [{ type: "text", text: `${header}\n\n<reviews>\n${shown.join("\n\n")}\n</reviews>\n${EXTERNAL_REVIEWS_NOTE}` }], details: { shown: shown.length, of: kept.length, page } };
      },
    };
  }

  private static line(review: StoredRunReview): string {
    Trace.tick(import.meta.url, "ReadReviewsTool.line");
    const text = review.text.length > ReadReviewsTool.CHARS ? `${review.text.slice(0, ReadReviewsTool.CHARS)}…` : review.text;
    return `[${review.ref}] ${review.star ?? "?"}★ ${review.posted_at.slice(0, 10)} ${review.platform}${review.title ? ` — ${review.title}` : ""}\n${text}`;
  }
}
