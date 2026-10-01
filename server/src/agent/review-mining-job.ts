import {
  AmazonListingLookup,
  AmazonReviews,
  MeteredActorRunner,
  TrustpilotReviews,
  type ActorRunner,
} from "../adapters/apify/index.js";
import { Corpus } from "../adapters/corpus.js";
import type { Settings } from "../config/index.js";
import { Scope, type Brief, type MiningTarget, type ResearchStore } from "../domain/index.js";
import { ReviewMiningOffer, ReviewMiningRoster, type PullFailure } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";
import { ReviewFiling } from "./review-filing.js";
import { ReviewLedger } from "./review-ledger.js";
import { ReviewPuller, type PullJob } from "./review-puller.js";
import { StageOneHandoff } from "./stage-one-handoff.js";
import { ReviewMiningListings } from "./review-mining-listings.js";
import { ReviewMiningSettlement } from "./review-mining-settlement.js";

/** Review mining (stage 3), with no model in it: the offered targets' listings, their pulls, the computed packet. */
export class ReviewMiningJob {
  static readonly BANDS = [3, 1, 2, 4, 5] as const;
  static readonly RETRY_DELAY_MS = 10_000;

  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly settings: Settings,
    private readonly actors: ActorRunner | null,
    private readonly retryDelayMs = ReviewMiningJob.RETRY_DELAY_MS,
  ) {}

  start(runId: string, request: { brief: Brief; targets: readonly string[]; workspaceId: string }): { abort(): void; done: Promise<void> } {
    Trace.line(import.meta.url, "ReviewMiningJob.start", { runId, targets: request.targets });
    const stop = new AbortController();
    const ledger = new ReviewLedger();
    const settlement = new ReviewMiningSettlement(this.store, this.runs, runId, ledger);
    const done = this.mine(runId, request, ledger, stop.signal).then(
      (mined) => settlement.settle(request.brief, mined.targets, mined.failures, stop.signal.aborted),
      (error: unknown) => settlement.fail(error, stop.signal.aborted),
    ).catch((error: unknown) => settlement.fail(error, false));
    return { abort: () => stop.abort(new Error("stopped by the operator")), done };
  }

  private async mine(
    runId: string,
    request: { brief: Brief; targets: readonly string[]; workspaceId: string },
    ledger: ReviewLedger,
    signal: AbortSignal,
  ): Promise<{ targets: MiningTarget[]; failures: PullFailure[] }> {
    Trace.line(import.meta.url, "ReviewMiningJob.mine", { runId });
    if (!this.actors) throw new Error("APIFY_TOKEN is not set, so no review can be pulled");
    const handoff = new StageOneHandoff(this.store);
    const source = handoff.forBrief(request.brief, Scope.of(request.workspaceId));
    if (!source) throw new Error("no completed stage-1 run for this brief names the targets to mine");
    if (!handoff.hasCompleted(2, source.run.id, Scope.of(request.workspaceId))) {
      throw new Error(`product truth has not completed on stage-1 run ${source.run.id}, so review mining cannot start`);
    }
    this.store.updateRun(runId, { source_run_id: source.run.id });
    const runner = new MeteredActorRunner(this.actors, (charge) =>
      this.runs.emit(runId, "apify.charged", { actor: charge.actor, usd: charge.usd, status: charge.status }),
    );
    const roster = ReviewMiningRoster.of(source.packet);
    const listings = await new ReviewMiningListings(this.store.listings, new AmazonListingLookup(runner), this.settings.apifyConcurrency)
      .ensure(source.run.id, roster);
    const targets = ReviewMiningRoster.select(ReviewMiningOffer.of(roster, listings), request.targets);
    const puller = new ReviewPuller({
      retries: this.settings.apifyPullRetries,
      delayMs: this.retryDelayMs,
      concurrency: this.settings.apifyConcurrency,
      events: {
        started: (job, attempt) => this.runs.emit(runId, "tool.started", ReviewMiningJob.frame(job, attempt)),
        ended: (job, attempt, error) =>
          this.runs.emit(runId, "tool.completed", { ...ReviewMiningJob.frame(job, attempt), error: error !== "", ...(error ? { error_text: error } : {}), inside: [] }),
      },
    });
    const outcomes = await puller.pullAll(this.jobs(targets, runner), signal);
    const filing = new ReviewFiling(new Corpus(this.settings.corpusPath), runId, ledger);
    const failures: PullFailure[] = [];
    for (const outcome of outcomes) {
      if ("result" in outcome) await filing.file(outcome.job.label, outcome.result);
      else failures.push({ target_id: outcome.job.label.target_id, listing: outcome.job.label.listing, error: outcome.error });
    }
    return { targets, failures };
  }

  private jobs(targets: readonly MiningTarget[], runner: ActorRunner): PullJob[] {
    Trace.line(import.meta.url, "ReviewMiningJob.jobs", { targets: targets.length });
    const amazon = new AmazonReviews(runner);
    const trustpilot = new TrustpilotReviews(runner);
    const max = this.settings.apifyMaxReviews;
    return targets.flatMap((target): PullJob[] => {
      if (target.amazon_url) {
        return ReviewMiningJob.BANDS.map((star) => ({
          label: { target_id: target.id, platform: "amazon", listing: target.amazon_url, band: star },
          fetch: (signal?: AbortSignal) => amazon.fetch({ productUrl: target.amazon_url, star, maxReviews: max, signal }),
        }));
      }
      if (!target.trustpilot) return [];
      return [{
        label: { target_id: target.id, platform: "trustpilot", listing: target.trustpilot, band: null },
        fetch: (signal?: AbortSignal) => trustpilot.fetch({ domainOrUrl: target.trustpilot, star: null, maxItems: max, signal }),
      }];
    });
  }

  private static frame(job: PullJob, attempt: number): Record<string, unknown> {
    Trace.line(import.meta.url, "ReviewMiningJob.frame", { attempt });
    const { target_id, platform, listing, band } = job.label;
    return {
      tool: platform === "amazon" ? "amazon_reviews" : "trustpilot_reviews",
      tool_call_id: `${target_id}-${platform}-${band ?? "all"}-${attempt}`,
      preview: `${target_id} — ${listing}${band ? ` — ${band}★` : ""}${attempt > 0 ? ` — retry ${attempt}` : ""}`,
      lane: "fetch",
    };
  }
}
