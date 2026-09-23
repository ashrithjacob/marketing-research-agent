import {
  AMAZON_REVIEWS_ACTOR,
  STAR_BAND,
  Spend,
  TRUSTPILOT_ACTOR,
} from "./actors.js";
import { Field } from "./fields.js";
import type { ActorRunner } from "./runner.js";
import type { ReviewExcerpt, ReviewResult } from "./types.js";

/** Reviews for one company. These review the merchant, never the product. */
export class TrustpilotReviews {
  constructor(private readonly runner: ActorRunner) {}

  async fetch(options: {
      domainOrUrl: string;
      star: 1 | 2 | 3 | 4 | 5 | null;
      maxItems: number;
      signal?: AbortSignal;
  }): Promise<ReviewResult> {
    const { domainOrUrl, star, maxItems, signal } = options;
    const { status, items } = await this.runner.run(
      TRUSTPILOT_ACTOR,
      {
        startUrls: [{ url: domainOrUrl }],
        filterStars: star === null ? [] : [String(star)],
        maxItems,
        sortBy: "recent",
        filterLanguages: ["en"],
        includeCompanyDetails: false,
      },
      Spend.capFor(TRUSTPILOT_ACTOR, maxItems),
      signal,
    );

    const band = star === null ? "any star" : `${star}-star`;
    if (items.length === 0) {
      return {
        excerpts: [],
        gap: `Apify run finished ${status} with an empty dataset for ${domainOrUrl} (${band}).`,
        discarded: 0,
        totalReviews: null,
        totalRatings: null,
      };
    }

    const excerpts: ReviewExcerpt[] = [];
    let discarded = 0;
    for (const item of items) {
      const text = Field.text(item.text).trim();
      const starScore = Field.numberOrNull(item.rating);
      if (!text) continue;
      if (star !== null && starScore !== star) {
        discarded += 1;
        continue;
      }
      excerpts.push({
        text,
        star: starScore,
        date: Field.text(item.experiencedDate) || Field.text(item.publishedDate) || null,
        locator: Field.text(item.url) || Field.text(item.id),
        title: Field.text(item.title),
        verified: item.isVerified === true,
        source: "trustpilot",
      });
    }

    let gap: string | null = null;
    if (discarded > 0) {
      gap =
        `Discarded ${discarded} of ${items.length} Trustpilot rows for ${domainOrUrl}: ` +
        `asked for ${band} and other ratings came back.`;
    } else if (excerpts.length === 0) {
      gap = `Apify returned ${items.length} rows for ${domainOrUrl} (${band}) but none carried text.`;
    }
    return { excerpts, gap, discarded, totalReviews: null, totalRatings: null };
  }
}
