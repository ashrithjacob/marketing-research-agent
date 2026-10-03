import type { ReviewPullStore, ReviewResult, StoredPull } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { PullLabel } from "./review-filing.js";
import { ReviewPuller, type PullJob, type PullOutcome } from "./review-puller.js";

/** Pulls answered from an earlier pull of the same listing and star band, in any workspace, while that one is younger than the reuse window and holds as many reviews as asked for. The rest are pulled and kept for the next run; a kept pull too small for the ask is pulled again and joined to the new one, and stands alone if that pull fails. A failed or refused pull is never kept. */
export class ReviewReuse {
  constructor(
    private readonly pulls: ReviewPullStore,
    private readonly maxAgeDays: number,
    private readonly wanted: number,
    private readonly onReuse: (label: PullLabel, pulledAt: string) => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private readonly short = new Map<PullJob, StoredPull>();

  /** Splits the jobs before any is pulled, so a kept answer is used even after the review service has refused the others. */
  async split(jobs: readonly PullJob[]): Promise<{ reused: PullOutcome[]; toPull: PullJob[] }> {
    Trace.line(import.meta.url, "ReviewReuse.split", { jobs: jobs.length });
    const reused: PullOutcome[] = [];
    const toPull: PullJob[] = [];
    for (const job of jobs) {
      const { platform, listing, band } = job.label;
      const kept = await this.pulls.latest(platform, listing, band, this.since());
      if (!kept || !this.covers(kept)) {
        const pulling = this.keeping(job, kept);
        if (kept) this.short.set(pulling, kept);
        toPull.push(pulling);
        continue;
      }
      this.onReuse(job.label, kept.pulled_at);
      reused.push({ job, result: { ...kept.result, excerpts: kept.result.excerpts.slice(0, this.wanted), fetchedAt: kept.pulled_at } });
    }
    return { reused, toPull };
  }

  /** A kept pull answers when it holds as many reviews as wanted, or asked for at least that many and the listing had no more. */
  private covers(kept: StoredPull): boolean {
    Trace.line(import.meta.url, "ReviewReuse.covers", { requested: kept.requested, held: kept.result.excerpts.length, wanted: this.wanted });
    return kept.result.excerpts.length >= this.wanted || (kept.requested ?? 0) >= this.wanted;
  }

  /** Each pull that failed where a smaller kept pull exists, answered by that kept pull, with a gap saying the ask was not met. */
  settle(outcomes: readonly PullOutcome[]): PullOutcome[] {
    Trace.line(import.meta.url, "ReviewReuse.settle", { outcomes: outcomes.length, short: this.short.size });
    return outcomes.map((outcome) => {
      const kept = this.short.get(outcome.job);
      const error = "error" in outcome ? outcome.error : ReviewReuse.failed(outcome.result) ? outcome.result.gap ?? outcome.result.status : null;
      if (!kept || error === null) return outcome;
      this.onReuse(outcome.job.label, kept.pulled_at);
      const gap = `asked for ${this.wanted} reviews; the pull for more failed (${error}), so the ${kept.result.excerpts.length} kept from ${kept.pulled_at} stand`;
      return { job: outcome.job, result: { ...kept.result, gap, fetchedAt: kept.pulled_at } };
    });
  }

  private keeping(job: PullJob, kept: StoredPull | null): PullJob {
    Trace.line(import.meta.url, "ReviewReuse.keeping", { label: job.label, kept: kept !== null });
    const { platform, listing, band } = job.label;
    return {
      label: job.label,
      fetch: async (signal?: AbortSignal): Promise<ReviewResult> => {
        Trace.line(import.meta.url, "ReviewReuse.keeping.fetch", { listing, band });
        const pulled = await job.fetch(signal);
        if (ReviewReuse.failed(pulled)) return pulled;
        const result = kept ? ReviewReuse.joined(pulled, kept.result) : pulled;
        await this.pulls.save(platform, listing, band, this.wanted, result);
        return result;
      },
    };
  }

  /** The new pull's reviews, then every kept review it no longer returns, so no review already paid for is lost. */
  private static joined(pulled: ReviewResult, kept: ReviewResult): ReviewResult {
    Trace.line(import.meta.url, "ReviewReuse.joined", { pulled: pulled.excerpts.length, kept: kept.excerpts.length });
    const seen = new Set(pulled.excerpts.map((excerpt) => excerpt.reviewKey));
    return { ...pulled, excerpts: [...pulled.excerpts, ...kept.excerpts.filter((excerpt) => !seen.has(excerpt.reviewKey))] };
  }

  private static failed(result: ReviewResult): boolean {
    Trace.line(import.meta.url, "ReviewReuse.failed", { status: result.status });
    return result.excerpts.length === 0 && ReviewPuller.FAILED_RUNS.has(result.status);
  }

  private since(): string {
    Trace.line(import.meta.url, "ReviewReuse.since", { maxAgeDays: this.maxAgeDays });
    return new Date(this.now().getTime() - this.maxAgeDays * 86_400_000).toISOString();
  }
}
