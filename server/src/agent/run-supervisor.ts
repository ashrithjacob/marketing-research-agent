import { createModels, type Models } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";

import { OpenRouterPrices } from "../adapters/index.js";
import type { Settings } from "../config/index.js";
import {
  Clock,
  type Judgement,
  RejectKinds,
  type ResearchStore,
  type RunRequest,
  Stages,
  TERMINAL_STATUSES,
} from "../domain/index.js";

import { RunError } from "./errors.js";
import { LiveRuns, type Subscriber } from "./live-runs.js";
import { ModelPricing } from "./pricing.js";
import { AgentMessages, PromptBuilder } from "./prompt/index.js";
import { DEFAULT_RETRY, type RetryPolicy } from "./retry.js";
import { RunAgentFactory } from "./run-agent-factory.js";

/** Owns a research run for its whole life: one Agent per run, in this process. */
export class RunSupervisor {
  private readonly store: ResearchStore;
  private readonly settings: Settings;
  private readonly models: Models;
  readonly costs: OpenRouterPrices;
  private readonly retry: RetryPolicy;
  private readonly runs: LiveRuns;
  private readonly factory: RunAgentFactory;

  constructor(options: {
    store: ResearchStore;
    settings: Settings;
    models?: Models;
    costs?: OpenRouterPrices;
    retry?: RetryPolicy;
  }) {
    this.store = options.store;
    this.runs = new LiveRuns(options.store);
    this.settings = options.settings;
    this.retry = options.retry ?? DEFAULT_RETRY;
    this.costs =
      options.costs ?? new OpenRouterPrices({ apiKey: options.settings.openrouterApiKey });
    this.models = options.models ?? RunSupervisor.defaultModels();
    this.factory = new RunAgentFactory(
      this.settings,
      this.store,
      this.runs,
      this.models,
      this.costs,
      this.retry,
      new PromptBuilder(),
    );
  }

  readonly subscribe = (runId: string, subscriber: Subscriber): (() => void) | null =>
    this.runs.subscribe(runId, subscriber);

  readonly isLive = (runId: string): boolean => this.runs.has(runId);

  readonly waitFor = (runId: string): Promise<void> => this.runs.waitFor(runId);

  start(request: RunRequest): string {
    const judgements = this.store.listJudgements(true);
    const rejectKinds = RejectKinds.effective(request, judgements);
    const modelId = request.model || this.settings.model;
    const nodes = Stages.expand(request.nodes);

    const run = this.store.createRun({
      brief: request.brief as unknown as Record<string, unknown>,
      model: modelId,
      rejectKinds,
      judgementIds: judgements.map((j) => j.id),
      nodes,
      stage: Stages.covering(nodes) ?? 1,
    });

    const listed = this.models.getModel("openrouter", modelId);
    if (!listed) {
      const error = `unknown model ${JSON.stringify(modelId)} for provider openrouter`;
      this.store.updateRun(run.id, { status: "failed", error, ended_at: Clock.nowIso() });
      this.runs.emit(run.id, "run.failed", { error });
      throw new RunError(error);
    }
    const { model, pricing } = new ModelPricing(this.costs).apply(listed);

    const { agent, done } = this.factory.assemble(run.id, {
      brief: request.brief,
      nodes,
      rejectKinds,
      judgements,
      model,
      pricing,
      targets: request.targets,
    });
    this.store.updateRun(run.id, {
      agent_run_id: run.id,
      session_id: `research-${run.id}`,
      status: "running",
    });
    this.runs.emit(run.id, "run.started", { model: modelId, nodes });
    this.runs.add(run.id, { agent, subscribers: new Set(), done });
    return run.id;
  }

  recoverRunsKilledByRestart(): void {
    for (const run of this.store.listRuns(200)) {
      if (TERMINAL_STATUSES.has(run.status)) continue;
      this.store.updateRun(run.id, {
        status: "failed",
        error: "the server restarted while this run was in progress; the run did not survive it",
        ended_at: Clock.nowIso(),
      });
      this.runs.emit(run.id, "run.failed", { error: "server restarted mid-run" });
    }
  }

  steer(runId: string, judgement: Judgement): void {
    const live = this.runs.controllable(runId);
    live.agent.steer({
      role: "user",
      content: [{ type: "text", text: AgentMessages.steer(judgement) }],
      timestamp: Date.now(),
    } as any);
    this.runs.emit(runId, "run.steered", { judgement_id: judgement.id, text: judgement.text });
  }

  stop(runId: string): void {
    const live = this.runs.controllable(runId);
    this.store.updateRun(runId, { status: "stopping" });
    this.runs.emit(runId, "run.stopping", {});
    live.agent.abort();
  }

  async close(): Promise<void> {
    this.costs.stop();
    this.runs.abortAll();
    await this.runs.drain();
  }

  private static defaultModels(): Models {
    const models = createModels();
    models.setProvider(openrouterProvider());
    return models;
  }
}
