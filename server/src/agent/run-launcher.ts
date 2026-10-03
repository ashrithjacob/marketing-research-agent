import type { Models } from "@earendil-works/pi-ai";

import type { OpenRouterPrices } from "../adapters/index.js";
import type { Settings } from "../config/index.js";
import { RejectKinds, Scope, Stages, productTruthInputsSchema, type ResearchRun, type ResearchStore, type RunRequest, type StagePacket } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { RunError } from "./errors.js";
import type { LiveRuns } from "./live-runs.js";
import { ModelChain } from "./model-chain.js";
import { ModelPricing } from "./pricing.js";
import { ProductTruthRun } from "./product-truth-run.js";
import { RunEnd } from "./run-end.js";
import type { RetryPolicy } from "./retry.js";
import type { ReviewMiningJob } from "./review-mining-job.js";
import type { ResearchAgentFactory } from "./research-agent-factory.js";
import type { StageOneHandoff } from "./stage-one-handoff.js";
import type { StageOneListings } from "./stage-one-listings.js";
import { StageOneRun } from "./stage-one-run.js";

export interface RunKinds {
  factory: ResearchAgentFactory;
  listings: StageOneListings;
  handoff: StageOneHandoff;
  mining: ReviewMiningJob;
}

/** Starts one run: records it, and hands LiveRuns the stage-1 agents or the product-truth agents, with their models resolved and priced, or the review-mining pipeline. */
export class RunLauncher {
  constructor(
    private readonly store: ResearchStore,
    private readonly settings: Settings,
    private readonly models: Models,
    private readonly costs: OpenRouterPrices,
    private readonly runs: LiveRuns,
    private readonly retry: RetryPolicy,
    private readonly kinds: RunKinds,
  ) {}

  async launch(request: RunRequest, workspaceId: string): Promise<string> {
    Trace.line(import.meta.url, "RunLauncher.launch", { request, workspaceId });
    const judgements = await this.store.listJudgements(Scope.of(workspaceId), true);
    const rejectKinds = RejectKinds.effective(request, judgements);
    const nodes = Stages.expand(request.nodes);
    const stage = Stages.covering(nodes) ?? 1;
    const run = await this.store.createRun({
      workspaceId,
      brief: request.brief as unknown as Record<string, unknown>,
      model: stage === 3 ? "" : this.settings.model,
      rejectKinds,
      judgementIds: judgements.map((j) => j.id),
      nodes,
      stage,
    });
    const header = { product: request.brief.product, url: request.brief.url, model: stage === 3 ? "pipeline" : this.settings.model, nodes };
    if (stage === 3) return this.launchPipeline(run, request, workspaceId, header);
    const chain = await this.chain(run.id);
    const { store, runs, costs, retry, kinds } = this;
    const deps = { store, runs, costs, retry };
    const brief = { runId: run.id, brief: request.brief, rejectKinds, judgements, chain };
    const team = stage === 2
      ? new ProductTruthRun({ ...deps, factory: kinds.factory }, { ...brief, ...(await this.source(run, request, workspaceId)), inputs: productTruthInputsSchema.parse(request.inputs ?? {}) })
      : new StageOneRun({ ...deps, factory: kinds.factory, listings: kinds.listings }, { ...brief, nodes });
    await this.store.updateRun(run.id, { agent_run_id: run.id, session_id: `research-${run.id}`, status: "running" });
    this.runs.emit(run.id, "run.started", { model: this.settings.model, nodes });
    const done = Trace.within(run.id, header, () => team.start());
    this.runs.add(run.id, { control: { abort: team.abort, steer: team.steer }, subscribers: new Set(), done });
    return run.id;
  }

  /** The configured model and its backups, priced; a model the provider does not know fails the run before anything starts. */
  private async chain(runId: string): Promise<ModelChain> {
    Trace.line(import.meta.url, "RunLauncher.chain", { runId });
    const resolved = ModelChain.resolve([this.settings.model, ...this.settings.backupModels], this.models, new ModelPricing(this.costs));
    if (!("unknown" in resolved)) return resolved.chain;
    const error = `unknown model ${JSON.stringify(resolved.unknown)} for provider openrouter`;
    await new RunEnd(this.store, this.runs).refuse(runId, error);
    throw new RunError(error);
  }

  /** The completed stage-1 run product truth reads, recorded on the run so a newer stage 1 shows this one as out of date. */
  private async source(run: ResearchRun, request: RunRequest, workspaceId: string): Promise<{ sourceRunId: string; stageOne: StagePacket }> {
    Trace.line(import.meta.url, "RunLauncher.source", { runId: run.id });
    const found = await this.kinds.handoff.forBrief(request.brief, Scope.of(workspaceId));
    if (!found) {
      const error = "product truth reads a completed stage-1 run, and this brief has none";
      await new RunEnd(this.store, this.runs).refuse(run.id, error);
      throw new RunError(error);
    }
    await this.store.updateRun(run.id, { source_run_id: found.run.id });
    return { sourceRunId: found.run.id, stageOne: found.packet };
  }

  private async launchPipeline(run: ResearchRun, request: RunRequest, workspaceId: string, header: Record<string, unknown>): Promise<string> {
    Trace.line(import.meta.url, "RunLauncher.launchPipeline", { workspaceId, targets: request.targets });
    const job = Trace.within(run.id, header, () =>
      this.kinds.mining.start(run.id, {
        brief: request.brief,
        targets: request.targets ?? [],
        reviewsPerBand: request.reviews_per_band ?? this.settings.apifyMaxReviews,
        workspaceId,
      }),
    );
    await this.store.updateRun(run.id, { status: "running" });
    this.runs.emit(run.id, "run.started", { model: "", nodes: run.nodes });
    this.runs.add(run.id, { control: { abort: job.abort }, subscribers: new Set(), done: job.done });
    return run.id;
  }
}
