import { Clock, type RunStore, type StageName, type StageState, type StageStates } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { RunContext } from "./run-context.js";

/** A run's stage states, held in memory and written whole after each change, one write at a time, so parallel stages never overwrite each other. */
export class StageProgress {
  private writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly states: StageStates,
    private readonly runs: RunStore,
    private readonly context: RunContext,
  ) {}

  state(name: StageName): StageState {
    Trace.line(import.meta.url, "StageProgress.state", { name });
    return this.states[name];
  }

  started(name: StageName): Promise<void> {
    Trace.line(import.meta.url, "StageProgress.started", { name });
    return this.set(name, { status: "running", started_at: Clock.nowIso() });
  }

  ended(name: StageName, change: Pick<StageState, "status" | "summary" | "error">): Promise<void> {
    Trace.line(import.meta.url, "StageProgress.ended", { name, status: change.status });
    return this.set(name, { ...change, ended_at: Clock.nowIso() });
  }

  snapshot(): StageStates {
    Trace.line(import.meta.url, "StageProgress.snapshot");
    return structuredClone(this.states);
  }

  private set(name: StageName, change: Partial<StageState>): Promise<void> {
    Trace.line(import.meta.url, "StageProgress.set", { name });
    this.states[name] = { ...this.states[name], ...change };
    const state = this.states[name];
    const snapshot = this.snapshot();
    this.writes = this.writes.then(async () => {
      await this.runs.updateRun(this.context.run.id, { stage_status: snapshot });
      await this.context.emit("stage.changed", { stage: name, ...state });
    });
    return this.writes;
  }
}
