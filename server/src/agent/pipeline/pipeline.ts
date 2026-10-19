import { STAGE_PLANS, type StageName, type StageStatus } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { Stage, StageInput } from "./stage.js";
import type { StageProgress } from "./stage-progress.js";

/** Runs the built stages, each as soon as every stage it needs has completed; a stage already completed (a rerun keeps it) counts as done without running, and a stage whose input did not complete is skipped and says which. */
export class Pipeline {
  private readonly stages: ReadonlyMap<StageName, Stage>;

  constructor(stages: readonly Stage[]) {
    Trace.line(import.meta.url, "Pipeline.constructor", { stages: stages.map((stage) => stage.name) });
    this.stages = new Map(stages.map((stage) => [stage.name, stage]));
  }

  get built(): StageName[] {
    Trace.line(import.meta.url, "Pipeline.built");
    return [...this.stages.keys()];
  }

  async run(input: StageInput, progress: StageProgress): Promise<void> {
    Trace.line(import.meta.url, "Pipeline.run", { runId: input.context.run.id });
    const finished = new Map<StageName, Promise<StageStatus>>();
    const finish = (name: StageName): Promise<StageStatus> => {
      const known = finished.get(name);
      if (known) return known;
      const started = this.runStage(name, input, progress, finish);
      finished.set(name, started);
      return started;
    };
    await Promise.all(this.built.map(finish));
  }

  private async runStage(name: StageName, input: StageInput, progress: StageProgress, finish: (name: StageName) => Promise<StageStatus>): Promise<StageStatus> {
    Trace.line(import.meta.url, "Pipeline.runStage", { name });
    if (progress.state(name).status === "completed") return "completed";
    const needs = STAGE_PLANS[name].needs.filter((need) => this.stages.has(need));
    const results = await Promise.all(needs.map(async (need) => [need, await finish(need)] as const));
    const missing = results.filter(([, status]) => status !== "completed").map(([need]) => need);
    if (input.context.signal.aborted) return this.close(name, progress, "cancelled", "", "the run was stopped");
    if (missing.length > 0) return this.close(name, progress, "skipped", "", `needs ${missing.join(", ")}, which did not complete`);
    await progress.started(name);
    try {
      const outcome = await this.stages.get(name)!.run(input);
      const status = input.context.signal.aborted ? "cancelled" : outcome.status;
      return this.close(name, progress, status, outcome.summary, outcome.error);
    } catch (error) {
      return this.close(name, progress, "failed", "", error instanceof Error ? error.message : String(error));
    }
  }

  private async close(name: StageName, progress: StageProgress, status: StageStatus, summary: string, error: string): Promise<StageStatus> {
    Trace.line(import.meta.url, "Pipeline.close", { name, status });
    await progress.ended(name, { status, summary, error });
    return status;
  }
}
