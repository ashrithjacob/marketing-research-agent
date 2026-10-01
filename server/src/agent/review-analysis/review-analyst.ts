import type { Models, Usage } from "@earendil-works/pi-ai";

import type { OpenRouterPrices } from "../../adapters/index.js";
import type { Settings } from "../../config/index.js";
import {
  Briefs,
  briefSchema,
  Clock,
  type ResearchRun,
  type ResearchStore,
  type ReviewAnalysis,
} from "../../domain/index.js";
import { ReviewMiningRoster } from "../../extract/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";
import { ModelChain } from "../model-chain.js";
import { ModelPricing } from "../pricing.js";
import { StageOneHandoff } from "../stage-one-handoff.js";
import { UsageTotals } from "../usage.js";

import { IssueTally } from "./issue-tally.js";
import { ReviewAnalysisJob } from "./review-analysis-job.js";
import { StructuredAsk } from "./structured-ask.js";

/** Starts a review-mining run's review analysis in the background and reports where it stands. */
export class ReviewAnalyst {
  static readonly MAX_TOKENS = 8000;

  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly handoff: StageOneHandoff;

  constructor(
    private readonly store: ResearchStore,
    private readonly settings: Settings,
    private readonly models: Models,
    private readonly costs: OpenRouterPrices,
  ) {
    Trace.line(import.meta.url, "ReviewAnalyst.constructor");
    this.handoff = new StageOneHandoff(store);
  }

  read(runId: string): ReviewAnalysis | null {
    Trace.line(import.meta.url, "ReviewAnalyst.read", { runId });
    const stored = this.store.getReviewAnalysis(runId);
    if (stored && !Array.isArray(stored.slices)) {
      return { ...stored, status: "failed", error: "stored by an earlier version of the analysis — run it again" };
    }
    if (stored?.status !== "running" || this.inFlight.has(runId)) return stored;
    return { ...stored, status: "failed", error: "interrupted: the server restarted while it ran" };
  }

  start(run: ResearchRun): ReviewAnalysis {
    Trace.line(import.meta.url, "ReviewAnalyst.start", { runId: run.id });
    if (this.inFlight.has(run.id)) throw new RunError("this run's reviews are already being analysed");
    const reviews = this.store.listRunReviews(run.id);
    if (reviews.length === 0) throw new RunError("this run stored no reviews to analyse");
    const resolved = ModelChain.resolve([this.settings.model, ...this.settings.backupModels], this.models, new ModelPricing(this.costs));
    if ("unknown" in resolved) throw new RunError(`unknown model ${JSON.stringify(resolved.unknown)} for provider openrouter`);
    const brief = Briefs.normalise(briefSchema.parse(run.brief));
    const source = this.handoff.forRun(run);
    const roster = source ? ReviewMiningRoster.of(source.packet) : [];
    const pending = ReviewAnalyst.pending(run.id, this.settings.model);
    this.store.saveReviewAnalysis(pending);
    let usage: Usage = UsageTotals.empty();
    let calls = 0;
    const onUsage = (next: Usage) => {
      calls += 1;
      usage = UsageTotals.add(usage, next);
    };
    const job = new ReviewAnalysisJob(new StructuredAsk(this.models, resolved.chain, ReviewAnalyst.MAX_TOKENS));
    const settle = (fields: Partial<ReviewAnalysis>) =>
      this.store.saveReviewAnalysis({ ...pending, ...fields, ended_at: Clock.nowIso(), llm_calls: calls, cost_usd: Number(usage.cost.total.toFixed(4)) });
    const work = job
      .run({ subject: Briefs.label(brief), reviews, roster }, onUsage)
      .then((findings) => settle({ ...findings, status: "done" }))
      .catch((error: unknown) => settle({ status: "failed", error: error instanceof Error ? error.message : String(error) }))
      .finally(() => this.inFlight.delete(run.id));
    this.inFlight.set(run.id, work);
    return pending;
  }

  waitFor(runId: string): Promise<void> {
    Trace.line(import.meta.url, "ReviewAnalyst.waitFor", { runId });
    return this.inFlight.get(runId) ?? Promise.resolve();
  }

  private static pending(runId: string, model: string): ReviewAnalysis {
    Trace.line(import.meta.url, "ReviewAnalyst.pending", { runId, model });
    return {
      run_id: runId,
      status: "running",
      error: "",
      started_at: Clock.nowIso(),
      ended_at: "",
      model,
      llm_calls: 0,
      cost_usd: 0,
      star_weights: IssueTally.STAR_WEIGHTS,
      cleaning: { fetched: 0, duplicates: 0, empty: 0, off_product: 0, untagged: 0, kept: 0 },
      issues: [],
      slices: [],
      products: [],
      quotes: {},
    };
  }
}
