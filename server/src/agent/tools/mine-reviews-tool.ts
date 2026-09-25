import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { AmazonReviews, ReviewResult, TrustpilotReviews } from "../../adapters/apify/index.js";
import { Http } from "../../adapters/http.js";
import type { Settings } from "../../config/index.js";

import type { FetchRecord } from "./lanes.js";
import { mineReviewsParameters } from "./parameters.js";
import { ReviewRendering } from "./review-rendering.js";

interface MiningJob {
  heading: string;
  source: string;
  fetch: (signal?: AbortSignal) => Promise<ReviewResult>;
}

/** Every band of every chosen listing, fetched in one round so a run waits on its slowest pull once. */
export class MineReviewsTool {
  static readonly BANDS = [3, 1, 2, 4, 5] as const;

  constructor(
    private readonly settings: Settings,
    private readonly amazon: AmazonReviews,
    private readonly trustpilot: TrustpilotReviews,
    private readonly runId: string,
    private readonly onFetch?: (record: FetchRecord) => void,
  ) {}

  tool(): AgentTool<typeof mineReviewsParameters> {
    return {
      name: "mine_reviews",
      label: "Mine reviews",
      description:
        "Fetch verbatim reviews for every chosen listing at once: each Amazon url " +
        "at all five star bands, plus one Trustpilot pull per merchant domain. " +
        "Call it ONCE with every listing, after amazon_find_product. Each section " +
        "carries its own source_id and GAP lines, exactly like amazon_reviews.",
      parameters: mineReviewsParameters,
      execute: async (_id, params, signal) => {
        const jobs = this.jobs(params.listings, params.trustpilot ?? []);
        const sections = await Http.pool(jobs, this.settings.apifyConcurrency, (job) =>
          this.section(job, signal),
        );
        return {
          content: [{ type: "text", text: sections.map((s) => s.text).join("\n\n=====\n\n") }],
          details: { pulls: jobs.length, sources: sections.map((s) => s.details) },
        };
      },
    };
  }

  private jobs(
    listings: ReadonlyArray<{ target_id: string; product_url: string }>,
    merchants: ReadonlyArray<{ target_id: string; domain: string }>,
  ): MiningJob[] {
    const limit = this.settings.apifyMaxReviews;
    const amazon = listings.flatMap((listing) =>
      MineReviewsTool.BANDS.map((star) => ({
        heading: `${listing.target_id} — Amazon ${star}-star — ${listing.product_url}`,
        source: listing.product_url,
        fetch: (signal?: AbortSignal) =>
          this.amazon.fetch({ productUrl: listing.product_url, star, maxReviews: limit, signal }),
      })),
    );
    const trustpilot = merchants.map((merchant) => ({
      heading: `${merchant.target_id} — Trustpilot (merchant) — ${merchant.domain}`,
      source: merchant.domain,
      fetch: (signal?: AbortSignal) =>
        this.trustpilot.fetch({ domainOrUrl: merchant.domain, star: null, maxItems: limit, signal }),
    }));
    return [...amazon, ...trustpilot];
  }

  private async section(
    job: MiningJob,
    signal?: AbortSignal,
  ): Promise<{ text: string; details: unknown }> {
    try {
      const result = await job.fetch(signal);
      const rendered = await ReviewRendering.render(
        this.settings,
        this.runId,
        job.source,
        result,
        this.onFetch,
      );
      return { text: `## ${job.heading}\n${rendered.content[0]!.text}`, details: rendered.details };
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      return {
        text:
          `## ${job.heading}\nGAP: this pull failed — ${why}\n` +
          "Record this as a gap entry. Retry it alone with amazon_reviews or " +
          "trustpilot_reviews only if the failure looks transient.",
        details: { source: job.source, error: why },
      };
    }
  }
}
