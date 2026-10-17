import { Trace } from "../trace/index.js";

interface LiveRun {
  controller: AbortController;
  done: Promise<void>;
}

/** The runs this process is working on right now, each with the controller that stops it. */
export class LiveRuns {
  private readonly runs = new Map<string, LiveRun>();

  start(runId: string, details: Record<string, unknown>, work: (signal: AbortSignal) => Promise<void>): void {
    Trace.line(import.meta.url, "LiveRuns.start", { runId });
    const controller = new AbortController();
    const done = Trace.within(runId, details, () => work(controller.signal))
      .catch((error: unknown) => console.error(`run ${runId}: background work failed`, error))
      .finally(() => this.runs.delete(runId));
    this.runs.set(runId, { controller, done });
  }

  has(runId: string): boolean {
    Trace.line(import.meta.url, "LiveRuns.has", { runId });
    return this.runs.has(runId);
  }

  stop(runId: string): boolean {
    Trace.line(import.meta.url, "LiveRuns.stop", { runId });
    const live = this.runs.get(runId);
    live?.controller.abort();
    return live !== undefined;
  }

  async stopAll(): Promise<void> {
    Trace.line(import.meta.url, "LiveRuns.stopAll", { count: this.runs.size });
    const all = [...this.runs.values()];
    for (const live of all) live.controller.abort();
    await Promise.all(all.map((live) => live.done));
  }
}
