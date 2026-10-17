import type { EventLog, RunEvent } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

export type Subscriber = (event: RunEvent) => void;

/** Stores each run event in order and hands it to whoever is watching the run live. */
export class RunEvents {
  private readonly subscribers = new Map<string, Set<Subscriber>>();
  private readonly tails = new Map<string, Promise<void>>();

  constructor(private readonly log: EventLog) {}

  emit(runId: string, kind: string, payload: Record<string, unknown>): Promise<void> {
    Trace.line(import.meta.url, "RunEvents.emit", { runId, kind });
    const previous = this.tails.get(runId) ?? Promise.resolve();
    const next = previous.then(async () => {
      const event = await this.log.add(runId, kind, payload);
      for (const subscriber of this.subscribers.get(runId) ?? []) subscriber(event);
    });
    const kept = next.catch((error: unknown) => console.error(`run ${runId}: storing event ${kind} failed`, error));
    this.tails.set(runId, kept);
    return kept;
  }

  subscribe(runId: string, subscriber: Subscriber): () => void {
    Trace.line(import.meta.url, "RunEvents.subscribe", { runId });
    const set = this.subscribers.get(runId) ?? new Set<Subscriber>();
    set.add(subscriber);
    this.subscribers.set(runId, set);
    return () => {
      set.delete(subscriber);
      if (set.size === 0) this.subscribers.delete(runId);
    };
  }

  async flushed(runId: string): Promise<void> {
    Trace.line(import.meta.url, "RunEvents.flushed", { runId });
    await this.tails.get(runId);
    this.tails.delete(runId);
  }
}
