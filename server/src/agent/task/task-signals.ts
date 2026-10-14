import type { Trip } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Carries a tripped breaker from the hook that saw it to the task that ends the work, inside this process. */
export class TaskSignals {
  private readonly trips = new Map<string, Trip>();
  private readonly waiting = new Map<string, Array<(trip: Trip) => void>>();

  trip(runId: string, trip: Trip): void {
    Trace.line(import.meta.url, "TaskSignals.trip", { runId, breaker: trip.breaker });
    if (this.trips.has(runId)) return;
    this.trips.set(runId, trip);
    for (const resolve of this.waiting.get(runId) ?? []) resolve(trip);
    this.waiting.delete(runId);
  }

  tripped(runId: string): Trip | null {
    Trace.line(import.meta.url, "TaskSignals.tripped", { runId });
    return this.trips.get(runId) ?? null;
  }

  wait(runId: string): Promise<Trip> {
    Trace.line(import.meta.url, "TaskSignals.wait", { runId });
    const already = this.trips.get(runId);
    if (already) return Promise.resolve(already);
    return new Promise((resolve) => this.waiting.set(runId, [...(this.waiting.get(runId) ?? []), resolve]));
  }

  forget(runId: string): void {
    Trace.line(import.meta.url, "TaskSignals.forget", { runId });
    this.trips.delete(runId);
    this.waiting.delete(runId);
  }
}
