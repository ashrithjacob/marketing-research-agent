import type { ReviewPullStore, ReviewResult } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { PullLabel } from "./review-filing.js";
import { ReviewPuller, type PullJob, type PullOutcome } from "./review-puller.js";

/** Pulls answered from an earlier pull of the same listing and star band, in any workspace, while that one is younger than the reuse window; the rest are pulled and kept for the next run. A failed or refused pull is never kept. */
export class ReviewReuse {
  constructor(
    private readonly pulls: ReviewPullStore,
    private readonly maxAgeDays: number,
    private readonly onReuse: (label: PullLabel, pulledAt: string) => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Splits the jobs before any is pulled, so a kept answer is used even after the review service has refused the others. */
  async split(jobs: readonly PullJob[]): Promise<{ reused: PullOutcome[]; toPull: PullJob[] }> {
    Trace.line(import.meta.url, "ReviewReuse.split", { jobs: jobs.length });
    const reused: PullOutcome[] = [];
    const toPull: PullJob[] = [];
    for (const job of jobs) {
      const { platform, listing, band } = job.label;
      const kept = await this.pulls.latest(platform, listing, band, this.since());
      if (!kept) {
        toPull.push(this.keeping(job));
        continue;
      }
      this.onReuse(job.label, kept.pulled_at);
      reused.push({ job, result: { ...kept.result, fetchedAt: kept.pulled_at } });
    }
    return { reused, toPull };
  }

  private keeping(job: PullJob): PullJob {
    Trace.line(import.meta.url, "ReviewReuse.keeping", { label: job.label });
    const { platform, listing, band } = job.label;
    return {
      label: job.label,
      fetch: async (signal?: AbortSignal): Promise<ReviewResult> => {
        Trace.line(import.meta.url, "ReviewReuse.keeping.fetch", { listing, band });
        const result = await job.fetch(signal);
        if (!(result.excerpts.length === 0 && ReviewPuller.FAILED_RUNS.has(result.status))) await this.pulls.save(platform, listing, band, result);
        return result;
      },
    };
  }

  private since(): string {
    Trace.line(import.meta.url, "ReviewReuse.since", { maxAgeDays: this.maxAgeDays });
    return new Date(this.now().getTime() - this.maxAgeDays * 86_400_000).toISOString();
  }
}
