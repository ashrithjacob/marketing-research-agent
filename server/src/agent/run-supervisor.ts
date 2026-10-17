import { createModels, type Models } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";

import { Corpus } from "../adapters/corpus.js";
import { OpenRouterPrices, RunBilling, ServiceClients } from "../adapters/index.js";
import type { Settings } from "../config/index.js";
import {
  FeedbackStrengths,
  type Judgement,
  type ResearchStore,
  type RunRequest,
  Scope,
  TERMINAL_STATUSES,
} from "../domain/index.js";

import { Trace } from "../trace/index.js";

import { LiveRuns, type Subscriber } from "./live-runs.js";
import { AgentMessages } from "./prompt/index.js";
import { ResearchAgentFactory } from "./research-agent-factory.js";
import { ToolRegistry } from "./tools/index.js";
import { StageOneHandoff } from "./stage-one-handoff.js";
import { DEFAULT_RETRY, type RetryPolicy } from "./retry.js";
import { StageOneListings } from "./stage-one-listings.js";
import { ReviewMiningJob } from "./review-mining-job.js";
import { RunError } from "./errors.js";
import { InvalidRunResettle } from "./invalid-run-resettle.js";
import { RunEnd } from "./run-end.js";
import { RunLauncher } from "./run-launcher.js";
import { RunWrapUp } from "./run-wrap-up.js";
import { StoredRunAssembly } from "./stored-run-assembly.js";

/** Owns a research run for its whole life: one Agent per run, in this process. */
export class RunSupervisor {
  private readonly store: ResearchStore;
  private readonly settings: Settings;
  readonly models: Models;
  readonly costs: OpenRouterPrices;
  private readonly runs: LiveRuns;
  private readonly launcher: RunLauncher;

  constructor(options: {
    store: ResearchStore;
    settings: Settings;
    models?: Models;
    costs?: OpenRouterPrices;
    retry?: RetryPolicy;
    services?: ServiceClients;
    pullRetryDelayMs?: number;
  }) {
    Trace.line(import.meta.url, "RunSupervisor.constructor");
    this.store = options.store;
    this.runs = new LiveRuns(options.store);
    this.settings = options.settings;
    this.costs = options.costs ?? new OpenRouterPrices({ apiKey: options.settings.openrouterApiKey });
    this.models = options.models ?? RunSupervisor.defaultModels();
    const services = options.services ?? ServiceClients.forSettings(options.settings);
    this.launcher = new RunLauncher(this.store, this.settings, this.models, this.costs, this.runs, options.retry ?? DEFAULT_RETRY, {
      factory: new ResearchAgentFactory(this.store, this.models, new ToolRegistry(services, this.settings), new Corpus(this.settings.corpusPath)),
      listings: new StageOneListings(this.store.listings, services.actors, services.pages, this.settings.apifyConcurrency),
      handoff: new StageOneHandoff(this.store),
      mining: new ReviewMiningJob(this.store, this.runs, this.settings, services.actors, options.pullRetryDelayMs),
    });
  }

  get live(): LiveRuns {
    Trace.line(import.meta.url, "RunSupervisor.live");
    return this.runs;
  }

  readonly subscribe = (runId: string, subscriber: Subscriber): (() => void) | null => {
    Trace.line(import.meta.url, "RunSupervisor.subscribe", { runId, subscriber });
    return this.runs.subscribe(runId, subscriber);
  };

  readonly isLive = (runId: string): boolean => {
    Trace.line(import.meta.url, "RunSupervisor.isLive", { runId });
    return this.runs.has(runId);
  };

  readonly waitFor = (runId: string): Promise<void> => {
    Trace.line(import.meta.url, "RunSupervisor.waitFor", { runId });
    return this.runs.waitFor(runId);
  };

  start(request: RunRequest, workspaceId: string): Promise<string> {
    Trace.line(import.meta.url, "RunSupervisor.start", { request, workspaceId });
    return this.launcher.launch(request, workspaceId);
  }

  /** Every stage run a restart left unfinished ends from its ledger, so what its agents found is shown; no model or paid tool is called. A task's run is left to the harness, which resumes it. */
  async recoverRunsKilledByRestart(): Promise<void> {
    Trace.line(import.meta.url, "RunSupervisor.recoverRunsKilledByRestart");
    const end = new RunEnd(this.store, this.runs);
    for (const run of await this.store.listRuns(Scope.everything, 200)) {
      if (TERMINAL_STATUSES.has(run.status) || run.contract) continue;
      await end.end(StoredRunAssembly.of(this.store, this.runs, run), { kind: "restarted" });
    }
  }

  /** Settles again the invalid runs from before rows were repaired, so a refresh shows what they found. */
  resettleInvalidRuns(): Promise<string[]> {
    Trace.line(import.meta.url, "RunSupervisor.resettleInvalidRuns");
    return new InvalidRunResettle(this.store, this.runs).resettleAll();
  }

  /** Rewrites a finished market-truth run's gate for the owner, as a run now does when it ends; its billed cost is added to the run's. */
  async reword(runId: string): Promise<number> {
    Trace.line(import.meta.url, "RunSupervisor.reword", { runId });
    const run = await this.store.getRun(runId);
    if (!run || run.stage !== 4) throw new RunError("only a market-truth run has a gate to rewrite");
    const billing = new RunBilling(this.costs);
    const kept = await this.launcher.reword().apply(runId, billing);
    await new RunWrapUp(this.store, this.runs, runId).addBilling(billing);
    return kept;
  }

  async steer(runId: string, judgement: Judgement): Promise<void> {
    Trace.line(import.meta.url, "RunSupervisor.steer", { runId, judgement });
    const live = await this.runs.controllable(runId);
    if (!live.control.steer) throw new RunError(`run ${runId} is the review-mining pipeline: there is no agent to steer`);
    live.control.steer(AgentMessages.steer(judgement));
    this.runs.emit(runId, "run.steered", { judgement_id: judgement.id, text: judgement.text });
    const run = await this.store.getRun(runId);
    if (run) await this.store.feedback.record(run.workspace_id, { verdict: "steer", target: FeedbackStrengths.target("task", runId, { run_id: runId }), text: judgement.text });
  }

  async stop(runId: string): Promise<void> {
    Trace.line(import.meta.url, "RunSupervisor.stop", { runId });
    const live = await this.runs.controllable(runId);
    await this.store.updateRun(runId, { status: "stopping" });
    this.runs.emit(runId, "run.stopping", {});
    live.control.abort();
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "RunSupervisor.close");
    this.costs.stop();
    this.runs.abortAll();
    await this.runs.drain();
  }

  static defaultModels(): Models {
    Trace.line(import.meta.url, "RunSupervisor.defaultModels");
    const models = createModels();
    models.setProvider(openrouterProvider());
    return models;
  }
}
