import type { Trip } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** What stops a task's current round: a tripped breaker, or a question the stop_when judge wants put to the owner. */
export type Halt = { trip: Trip } | { ask: string };

/** Carries a halt from the hook that saw it to the task that acts on it, and the owner's answer back to a waiting task, inside this process. The durable record of both is in the research store. */
export class TaskSignals {
  private readonly halts = new Map<string, Halt>();
  private readonly waiting = new Map<string, Array<(halt: Halt) => void>>();
  private readonly answers = new Map<string, Array<() => void>>();

  trip(runId: string, trip: Trip): void {
    Trace.line(import.meta.url, "TaskSignals.trip", { runId, breaker: trip.breaker });
    this.halt(runId, { trip });
  }

  ask(runId: string, question: string): void {
    Trace.line(import.meta.url, "TaskSignals.ask", { runId });
    this.halt(runId, { ask: question });
  }

  tripped(runId: string): Trip | null {
    Trace.line(import.meta.url, "TaskSignals.tripped", { runId });
    const halt = this.halts.get(runId);
    return halt && "trip" in halt ? halt.trip : null;
  }

  halted(runId: string): boolean {
    Trace.line(import.meta.url, "TaskSignals.halted", { runId });
    return this.halts.has(runId);
  }

  wait(runId: string): Promise<Halt> {
    Trace.line(import.meta.url, "TaskSignals.wait", { runId });
    const already = this.halts.get(runId);
    if (already) return Promise.resolve(already);
    return new Promise((resolve) => this.waiting.set(runId, [...(this.waiting.get(runId) ?? []), resolve]));
  }

  /** A question has been put to the owner; the next round starts with no halt. */
  resume(runId: string): void {
    Trace.line(import.meta.url, "TaskSignals.resume", { runId });
    this.halts.delete(runId);
  }

  answered(runId: string): void {
    Trace.line(import.meta.url, "TaskSignals.answered", { runId });
    for (const wake of this.answers.get(runId) ?? []) wake();
    this.answers.delete(runId);
  }

  answer(runId: string, timeoutMs: number): Promise<void> {
    Trace.line(import.meta.url, "TaskSignals.answer", { runId, timeoutMs });
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      this.answers.set(runId, [...(this.answers.get(runId) ?? []), () => (clearTimeout(timer), resolve())]);
    });
  }

  forget(runId: string): void {
    Trace.line(import.meta.url, "TaskSignals.forget", { runId });
    this.halts.delete(runId);
    this.waiting.delete(runId);
    this.answers.delete(runId);
  }

  private halt(runId: string, halt: Halt): void {
    Trace.line(import.meta.url, "TaskSignals.halt", { runId });
    if (this.halts.has(runId)) return;
    this.halts.set(runId, halt);
    for (const resolve of this.waiting.get(runId) ?? []) resolve(halt);
    this.waiting.delete(runId);
  }
}
