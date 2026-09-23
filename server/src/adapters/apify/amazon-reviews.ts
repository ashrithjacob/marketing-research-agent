import {
  AMAZON_REVIEWS_ACTOR,
  STAR_BAND,
  Spend,
  TRUSTPILOT_ACTOR,
} from "./actors.js";
import { Field } from "./fields.js";
import type { ActorRunner } from "./runner.js";
import type { ReviewExcerpt, ReviewResult } from "./types.js";

/** Reviews for one product at one star band; one band per call, so the spread can be checked. */
export class AmazonReviews {
  constructor(private readonly runner: ActorRunner) {}

  async fetch(options: {
      productUrl: string;
      star: 1 | 2 | 3 | 4 | 5 | null;
      maxReviews: number;
      signal?: AbortSignal;
  }): Promise<ReviewResult> {
    const { productUrl, star, maxReviews, signal } = options;
    const { status, items } = await this.runner.run(
      AMAZON_REVIEWS_ACTOR,
      {
        productUrls: [{ url: productUrl }],
        filterByRatings: [star === null ? "allStars" : STAR_BAND[star]],
        maxReviews,
        sort: "recent",
        includeGdprSensitive: false,
        scrapeProductDetails: false,
      },
      Spend.capFor(AMAZON_REVIEWS_ACTOR, maxReviews),
      signal,
    );

    const band = star === null ? "any star" : `${star}-star`;
    if (items.length === 0) {
      return {
        excerpts: [],
        gap: `Apify run finished ${status} with an empty dataset for ${productUrl} ` +
          `(${band}). That is not evidence the product has no reviews.`,
        discarded: 0,
        totalReviews: null,
        totalRatings: null,
      };
    }

    const first = items[0] ?? {};
    const totalRatings = Field.numberOrNull(first.totalCategoryRatings);
    const totalReviews = Field.numberOrNull(first.totalCategoryReviews);
    if (Field.text(first.error)) {
      const why =
        Field.text(first.error) === "no_relevant_reviews_found"
          ? `No ${band} reviews with text on ${productUrl}` +
            (totalRatings !== null ? ` (${totalRatings} ratings exist, none written at this band)` : "")
          : `Apify reported ${Field.text(first.error)} for ${productUrl}: ${Field.text(first.errorDescription)}`;
      return { excerpts: [], gap: why, discarded: 0, totalReviews, totalRatings };
    }

    const excerpts: ReviewExcerpt[] = [];
    let discarded = 0;
    for (const item of items) {
      const text = Field.text(item.reviewDescription).trim();
      const starScore = Field.numberOrNull(item.ratingScore);
      if (!text) continue;
      if (star !== null && starScore !== star) {
        discarded += 1;
        continue;
      }
      excerpts.push({
        text,
        star: starScore,
        date: Field.text(item.date) || null,
        locator: Field.text(item.reviewUrl) || Field.text(item.reviewId),
        title: Field.text(item.reviewTitle),
        verified: item.isVerified === true,
        source: "amazon",
      });
    }

    let gap: string | null = null;
    if (discarded > 0) {
      gap =
        `Discarded ${discarded} of ${items.length} Amazon rows for ${productUrl}: ` +
        `asked for ${band} and the actor returned other ratings. Star data from this ` +
        "call is not trustworthy.";
    } else if (excerpts.length === 0) {
      gap = `Apify returned ${items.length} rows for ${productUrl} (${band}) but none carried review text.`;
    }
    return { excerpts, gap, discarded, totalReviews, totalRatings };
  }
}
