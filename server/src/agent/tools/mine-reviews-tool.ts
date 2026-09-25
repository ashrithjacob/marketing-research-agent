import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { AmazonReviews, ReviewResult, TrustpilotReviews } from "../../adapters/apify/index.js";
import { Http } from "../../adapters/http.js";
import type { Settings } from "../../config/index.js";

import { mineReviewsParameters } from "./parameters.js";
import type { PullLabel, ReviewRendering } from "./review-rendering.js";

interface MiningJob {
  heading: string;
  label: PullLabel;
  fetch: (signal?: AbortSignal) => Promise<ReviewResult>;
}

/** Every band of every chosen listing, fetched in one round so a run waits on its slowest pull once. */
export class MineReviewsTool {
  static readonly BANDS = [3, 1, 2, 4, 5] as const;

  constructor(
    private readonly settings: Settings,
    private readonly amazon: AmazonReviews,
    private readonly trustpilot: TrustpilotReviews,
    private readonly rendering: ReviewRendering,
  ) {}

  tool(): AgentTool<typeof mineReviewsParameters> {
    return {
      name: "mine_reviews",
      label: "Mine reviews",
      description:
        "Fetch verbatim reviews for every chosen listing at once: each Amazon url " +
        "at all five star bands, plus one Trustpilot pull per merchant domain. " +
        "Call it ONCE with every listing, after amazon_find_product. Every review " +
        "goes into this run's ledger and from there into the packet; the result is " +
        "a count per pull, its pull handle and any GAP lines — never the reviews.",
      parameters: mineReviewsParameters,
      execute: async (_id, params, signal) => {
        const jobs = this.jobs(params.listings, params.trustpilot ?? []);
        const fetched = await Http.pool(jobs, this.settings.apifyConcurrency, (job) =>
          MineReviewsTool.attempt(job, signal),
        );
        const sections: Array<{ text: string; details: unknown }> = [];
        for (const [i, job] of jobs.entries()) sections.push(await this.section(job, fetched[i]!));
        const text = [...sections.map((s) => s.text), this.rendering.footer()].join("\n\n=====\n\n");
        return {
          content: [{ type: "text", text }],
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
        label: {
          target_id: listing.target_id,
          platform: "amazon" as const,
          listing: listing.product_url,
          band: star,
        },
        fetch: (signal?: AbortSignal) =>
          this.amazon.fetch({ productUrl: listing.product_url, star, maxReviews: limit, signal }),
      })),
    );
    const trustpilot = merchants.map((merchant) => ({
      heading: `${merchant.target_id} — Trustpilot (merchant) — ${merchant.domain}`,
      label: {
        target_id: merchant.target_id,
        platform: "trustpilot" as const,
        listing: merchant.domain,
        band: null,
      },
      fetch: (signal?: AbortSignal) =>
        this.trustpilot.fetch({ domainOrUrl: merchant.domain, star: null, maxItems: limit, signal }),
    }));
    return [...amazon, ...trustpilot];
  }

  private static async attempt(
    job: MiningJob,
    signal?: AbortSignal,
  ): Promise<ReviewResult | { failed: string }> {
    try {
      return await job.fetch(signal);
    } catch (error) {
      return { failed: error instanceof Error ? error.message : String(error) };
    }
  }

  private async section(
    job: MiningJob,
    fetched: ReviewResult | { failed: string },
  ): Promise<{ text: string; details: unknown }> {
    if ("failed" in fetched) {
      const why = fetched.failed;
      return {
        text:
          `## ${job.heading}\nGAP: this pull failed — ${why}\n` +
          "Record this as a gap entry. Retry it alone with amazon_reviews or " +
          "trustpilot_reviews only if the failure looks transient.",
        details: { source: job.label.listing, error: why },
      };
    }
    const rendered = await this.rendering.render(job.label, fetched);
    return { text: `## ${job.heading}\n${rendered.text}`, details: rendered.details };
  }
}
