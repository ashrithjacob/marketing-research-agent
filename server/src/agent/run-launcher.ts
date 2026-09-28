import type { Models } from "@earendil-works/pi-ai";

import type { OpenRouterPrices } from "../adapters/index.js";
import type { Settings } from "../config/index.js";
import { Clock, RejectKinds, type ResearchStore, type RunRequest, Scope, Stages } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { RunError } from "./errors.js";
import type { LiveRuns } from "./live-runs.js";
import { ModelChain } from "./model-chain.js";
import { ModelPricing } from "./pricing.js";
import type { RunAgentFactory } from "./run-agent-factory.js";

/** Starts one run: records it, resolves its models and prices, and hands the agent to LiveRuns. */
export class RunLauncher {
  constructor(
    private readonly store: ResearchStore,
    private readonly settings: Settings,
    private readonly models: Models,
    private readonly costs: OpenRouterPrices,
    private readonly runs: LiveRuns,
    private readonly factory: RunAgentFactory,
  ) {}

  launch(request: RunRequest, workspaceId: string): string {
    Trace.line(import.meta.url, "RunLauncher.launch", { request, workspaceId });
    const judgements = this.store.listJudgements(Scope.of(workspaceId), true);
    const rejectKinds = RejectKinds.effective(request, judgements);
    const modelId = this.settings.model;
    const nodes = Stages.expand(request.nodes);

    const run = this.store.createRun({
      workspaceId,
      brief: request.brief as unknown as Record<string, unknown>,
      model: modelId,
      rejectKinds,
      judgementIds: judgements.map((j) => j.id),
      nodes,
      stage: Stages.covering(nodes) ?? 1,
    });

    const resolved = ModelChain.resolve(
      [modelId, ...this.settings.backupModels],
      this.models,
      new ModelPricing(this.costs),
    );
    if ("unknown" in resolved) {
      const error = `unknown model ${JSON.stringify(resolved.unknown)} for provider openrouter`;
      this.store.updateRun(run.id, { status: "failed", error, ended_at: Clock.nowIso() });
      this.runs.emit(run.id, "run.failed", { error });
      throw new RunError(error);
    }

    const header = { product: request.brief.product, url: request.brief.url, model: modelId, nodes };
    const { agent, done } = Trace.within(run.id, header, () =>
      this.factory.assemble(run.id, {
        workspaceId,
        brief: request.brief,
        nodes,
        rejectKinds,
        judgements,
        chain: resolved.chain,
        targets: request.targets,
      }),
    );
    this.store.updateRun(run.id, { agent_run_id: run.id, session_id: `research-${run.id}`, status: "running" });
    this.runs.emit(run.id, "run.started", { model: modelId, nodes });
    this.runs.add(run.id, { agent, subscribers: new Set(), done });
    return run.id;
  }
}
