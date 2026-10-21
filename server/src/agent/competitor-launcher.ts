import type { Competitor, Product, Run } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";
import type { Pipeline } from "./pipeline/pipeline.js";
import { RunContext, type RunServices } from "./pipeline/run-context.js";
import type { CompetitorSearch } from "./resolve/competitor-search.js";
import type { ResolutionSignals } from "./resolve/resolution-signals.js";
import type { ResolutionVisuals } from "./resolve/resolution-visuals.js";
import { RunEnd } from "./run-end.js";
import type { RunLauncher } from "./run-launcher.js";

/** Runs a finished run's competitor work in the background: searching for more to propose, and researching the ones the user adds. Either ends the run with the stages' standing verdict, its cost now including this work. */
export class CompetitorLauncher {
  constructor(
    private readonly services: RunServices,
    private readonly live: LiveRuns,
    private readonly runs: RunLauncher,
    private readonly pipeline: Pipeline,
    private readonly searcher: CompetitorSearch,
    private readonly visuals: ResolutionVisuals,
    private readonly signals: ResolutionSignals,
  ) {}

  search(run: Run, product: Product, known: readonly string[]): void {
    Trace.line(import.meta.url, "CompetitorLauncher.search", { runId: run.id, known: known.length });
    this.background(run, "search competitors", async (context) => {
      const result = await this.searcher.search(context, product, known);
      await context.settled();
      if (result.status !== "completed") {
        const error = result.status === "invalid" ? result.problems.join("; ") : result.status === "failed" ? result.error : "stopped";
        await context.emit("competitors.searched", { found: 0, error });
        return;
      }
      const resolution = { ...run.resolution!, competitors: [...run.resolution!.competitors, ...result.value.competitors] };
      await Promise.all([this.visuals.collect(resolution, context.signal), this.signals.collect(resolution, context.signal)]);
      await this.services.store.runs.updateRun(run.id, { resolution });
      await context.emit("competitors.searched", { found: result.value.competitors.length, error: "" });
    });
  }

  add(run: Run, product: Product, added: readonly Competitor[]): void {
    Trace.line(import.meta.url, "CompetitorLauncher.add", { runId: run.id, added: added.length });
    this.background(run, "add competitors", async (context) => {
      const lines = await this.pipeline.add({ context, product, competitors: added });
      await context.settled();
      await context.emit("competitors.added", { competitors: added.map((c) => c.brand), lines });
    });
  }

  private background(run: Run, phase: string, work: (context: RunContext) => Promise<void>): void {
    Trace.line(import.meta.url, "CompetitorLauncher.background", { runId: run.id, phase });
    const chain = this.runs.chain();
    this.live.start(run.id, { phase }, async (signal) => {
      const context = new RunContext(run, signal, this.services, chain);
      try {
        await work(context);
        await this.runs.runEnd.end(run.id, RunEnd.verdict(run.stage_status, signal.aborted));
      } catch (error) {
        await this.runs.crashed(run.id, context, error);
      }
    });
  }
}
