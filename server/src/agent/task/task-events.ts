import { Trace } from "../../trace/index.js";

/** Tells whoever listens that a task's run has ended, without the task knowing who listens. */
export class TaskEvents {
  private readonly listeners = new Set<(runId: string, status: string) => Promise<void>>();
  private readonly askers = new Set<(runId: string, question: string) => Promise<void>>();

  on(listener: (runId: string, status: string) => Promise<void>): void {
    Trace.line(import.meta.url, "TaskEvents.on");
    this.listeners.add(listener);
  }

  onAsked(listener: (runId: string, question: string) => Promise<void>): void {
    Trace.line(import.meta.url, "TaskEvents.onAsked");
    this.askers.add(listener);
  }

  async asked(runId: string, question: string): Promise<void> {
    Trace.line(import.meta.url, "TaskEvents.asked", { runId });
    for (const listener of this.askers) {
      await listener(runId, question).catch((error: unknown) => console.error(`research task ${runId}: an ask listener failed`, error));
    }
  }

  async ended(runId: string, status: string): Promise<void> {
    Trace.line(import.meta.url, "TaskEvents.ended", { runId, status });
    for (const listener of this.listeners) {
      await listener(runId, status).catch((error: unknown) => console.error(`research task ${runId}: an end listener failed`, error));
    }
  }
}
