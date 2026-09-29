import { ApifyCreditError, type ReviewResult } from "../adapters/apify/index.js";
import { Http } from "../adapters/http.js";
import { RateLimitWait } from "../adapters/rate-limit-wait.js";
import { Trace } from "../trace/index.js";

import type { PullLabel } from "./review-filing.js";

export interface PullJob {
  label: PullLabel;
  fetch: (signal?: AbortSignal) => Promise<ReviewResult>;
}

export type PullOutcome = { job: PullJob; result: ReviewResult } | { job: PullJob; error: string };

export interface PullEvents {
  started(job: PullJob, attempt: number): void;
  ended(job: PullJob, attempt: number, error: string): void;
}

/** Runs every pull, retrying a transient failure; an absent band is an answer, and running out of credit, or a Stop, ends the pulls not yet done without losing the ones that are. */
export class ReviewPuller {
  static readonly FAILED_RUNS: ReadonlySet<string> = new Set(["FAILED", "TIMED-OUT", "ABORTED"]);
  static readonly STOPPED = "stopped by the operator before this pull finished";

  private outOfCredit = "";

  constructor(
    private readonly options: { retries: number; delayMs: number; concurrency: number; events: PullEvents },
  ) {}

  async pullAll(jobs: readonly PullJob[], signal?: AbortSignal): Promise<PullOutcome[]> {
    Trace.line(import.meta.url, "ReviewPuller.pullAll", { jobs: jobs.length });
    return Http.pool(jobs, this.options.concurrency, (job) => this.pull(job, signal));
  }

  private async pull(job: PullJob, signal?: AbortSignal): Promise<PullOutcome> {
    Trace.line(import.meta.url, "ReviewPuller.pull", { label: job.label });
    const errors: string[] = [];
    for (let attempt = 0; ; attempt++) {
      if (this.outOfCredit) return { job, error: this.outOfCredit };
      if (signal?.aborted) return { job, error: ReviewPuller.STOPPED };
      this.options.events.started(job, attempt);
      const settled = await this.attempt(job, signal).then(
        (result) => (ReviewPuller.transient(result) ? `the Apify run ended ${result.status}` : result),
        (thrown: unknown) => ReviewPuller.failure(thrown, signal),
      );
      this.options.events.ended(job, attempt, typeof settled === "string" ? settled : "");
      if (typeof settled !== "string") return { job, result: settled };
      errors.push(settled);
      if (settled === this.outOfCredit || signal?.aborted || attempt >= this.options.retries) {
        return { job, error: errors.join("; then ") };
      }
      await RateLimitWait.sleep(this.options.delayMs, signal).catch(() => undefined);
    }
  }

  private async attempt(job: PullJob, signal?: AbortSignal): Promise<ReviewResult> {
    Trace.line(import.meta.url, "ReviewPuller.attempt", { label: job.label });
    try {
      return await job.fetch(signal);
    } catch (error) {
      if (error instanceof ApifyCreditError) this.outOfCredit = error.message;
      throw error;
    }
  }

  private static transient(result: ReviewResult): boolean {
    Trace.line(import.meta.url, "ReviewPuller.transient", { status: result.status });
    return result.excerpts.length === 0 && ReviewPuller.FAILED_RUNS.has(result.status);
  }

  private static failure(thrown: unknown, signal?: AbortSignal): string {
    Trace.line(import.meta.url, "ReviewPuller.failure");
    if (signal?.aborted) return ReviewPuller.STOPPED;
    return thrown instanceof Error ? thrown.message : String(thrown);
  }
}
