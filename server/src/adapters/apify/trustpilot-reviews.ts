import { Spend, TRUSTPILOT_ACTOR } from "./actors.js";
import { BandFiling } from "./band-filing.js";
import { Field, ReviewKey } from "./fields.js";
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
        offBand: 0,
        totalReviews: null,
        totalRatings: null,
      };
    }

    const rows: ReviewExcerpt[] = [];
    for (const item of items) {
      const text = Field.text(item.text).trim();
      if (!text) continue;
      const date = Field.text(item.experiencedDate) || Field.text(item.publishedDate) || null;
      rows.push({
        text,
        star: Field.numberOrNull(item.rating),
        date,
        locator: Field.text(item.url) || Field.text(item.id),
        title: Field.text(item.title),
        verified: item.isVerified === true,
        source: "trustpilot",
        reviewKey: ReviewKey.of(Field.text(item.id), domainOrUrl, date, text),
      });
    }

    const filed = BandFiling.file(rows, star, domainOrUrl);
    const gap =
      rows.length === 0
        ? `Apify returned ${items.length} rows for ${domainOrUrl} (${band}) but none carried text.`
        : filed.gap;
    return { excerpts: filed.excerpts, gap, offBand: filed.offBand, totalReviews: null, totalRatings: null };
  }
}
