import type { Settings } from "../config/index.js";
import type { Competitor, Product, Run } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { ModelChain } from "./kernel/model-chain.js";
import type { LiveRuns } from "./live-runs.js";
import type { Pipeline } from "./pipeline/pipeline.js";
import { RunContext, type RunServices } from "./pipeline/run-context.js";
import { StageProgress } from "./pipeline/stage-progress.js";
import type { ProductResolver } from "./resolve/product-resolver.js";
import type { ResolutionSignals } from "./resolve/resolution-signals.js";
import type { ResolutionVisuals } from "./resolve/resolution-visuals.js";
import { RunEnd } from "./run-end.js";

/** Runs a run's two phases in the background: resolving what the user typed, and, once they confirm, the stages. */
export class RunLauncher {
  readonly runEnd: RunEnd;

  constructor(
    private readonly services: RunServices,
    private readonly settings: Settings,
    private readonly live: LiveRuns,
    private readonly pipeline: Pipeline,
    private readonly resolver: ProductResolver,
    private readonly visuals: ResolutionVisuals,
    private readonly signals: ResolutionSignals,
  ) {
    Trace.line(import.meta.url, "RunLauncher.constructor");
    this.runEnd = new RunEnd(services.store, services.events);
  }

  chain(): ModelChain {
    Trace.line(import.meta.url, "RunLauncher.chain");
    const resolved = ModelChain.resolve([this.settings.model, ...this.settings.backupModels], this.services.models);
    if ("unknown" in resolved) throw new Error(`model ${resolved.unknown} is not in OpenRouter's catalogue; fix MRA_MODEL or MRA_BACKUP_MODELS`);
    return resolved.chain;
  }

  resolve(run: Run): void {
    Trace.line(import.meta.url, "RunLauncher.resolve", { runId: run.id });
    const chain = this.chain();
    this.live.start(run.id, { phase: "resolve", product: run.input.product_url ?? run.input.product_name }, async (signal) => {
      const context = new RunContext(run, signal, this.services, chain);
      try {
        const result = await this.resolver.resolve(context);
        await context.settled();
        if (result.status === "completed") {
          const [pictured, shops] = await Promise.all([this.visuals.collect(result.value, signal), this.signals.collect(result.value, signal)]);
          await context.emit("visuals.collected", { found: pictured, shops });
          await this.services.store.runs.updateRun(run.id, { status: "awaiting_confirmation", resolution: result.value });
          await context.emit("run.resolved", { competitors: result.value.competitors.length });
          return;
        }
        const error = result.status === "invalid" ? result.problems.join("; ") : result.status === "failed" ? result.error : "";
        await this.runEnd.end(run.id, { status: result.status, error: `resolving: ${error}` });
      } catch (error) {
        await this.crashed(run.id, context, error);
      }
    });
  }

  research(run: Run, product: Product, competitors: readonly Competitor[]): void {
    Trace.line(import.meta.url, "RunLauncher.research", { runId: run.id });
    const chain = this.chain();
    this.live.start(run.id, { phase: "research", product: product.url }, async (signal) => {
      const context = new RunContext(run, signal, this.services, chain);
      try {
        const progress = new StageProgress(structuredClone(run.stage_status), this.services.store.runs, context);
        await this.pipeline.run({ context, product, competitors }, progress);
        await context.settled();
        await this.runEnd.end(run.id, RunEnd.verdict(progress.snapshot(), signal.aborted));
      } catch (error) {
        await this.crashed(run.id, context, error);
      }
    });
  }

  private async crashed(runId: string, context: RunContext, error: unknown): Promise<void> {
    Trace.line(import.meta.url, "RunLauncher.crashed", { runId });
    console.error(`run ${runId} crashed`, error);
    await context.settled().catch(() => undefined);
    await this.runEnd.end(runId, { status: "failed", error: error instanceof Error ? error.message : String(error) });
  }
}
