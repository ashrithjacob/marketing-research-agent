import { Trace } from "../../trace/index.js";

/** Tells whoever listens that a task's run has ended, without the task knowing who listens. */
export class TaskEvents {
  private readonly listeners = new Set<(runId: string, status: string) => Promise<void>>();

  on(listener: (runId: string, status: string) => Promise<void>): void {
    Trace.line(import.meta.url, "TaskEvents.on");
    this.listeners.add(listener);
  }

  async ended(runId: string, status: string): Promise<void> {
    Trace.line(import.meta.url, "TaskEvents.ended", { runId, status });
    for (const listener of this.listeners) {
      await listener(runId, status).catch((error: unknown) => console.error(`research task ${runId}: an end listener failed`, error));
    }
  }
}
