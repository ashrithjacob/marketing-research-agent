import { TERMINAL_STATUSES, type ResearchStore } from "../domain/index.js";

import { RunError } from "./errors.js";
import type { EventFrame } from "./frames.js";
import { Trace } from "../trace/index.js";

export type Subscriber = (frame: EventFrame | null) => void;

/** What can be done to a run while it is in flight: every run can be stopped; only an agent can be steered. */
export interface RunControl {
  abort(): void;
  steer?: (text: string) => void;
}

export interface Live {
  control: RunControl;
  subscribers: Set<Subscriber>;
  done: Promise<void>;
}

/** The runs in flight in this process, and the browsers watching them. */
export class LiveRuns {
  private readonly live = new Map<string, Live>();

  constructor(private readonly store: ResearchStore) {}

  add(runId: string, live: Live): void {
    Trace.line(import.meta.url, "LiveRuns.add", { runId, live });
    this.live.set(runId, live);
  }

  remove(runId: string): void {
    Trace.line(import.meta.url, "LiveRuns.remove", { runId });
    this.live.delete(runId);
  }

  get(runId: string): Live | undefined {
    Trace.line(import.meta.url, "LiveRuns.get", { runId });
    return this.live.get(runId);
  }

  ids(): string[] {
    Trace.line(import.meta.url, "LiveRuns.ids");
    return [...this.live.keys()];
  }

  abortAll(): void {
    Trace.line(import.meta.url, "LiveRuns.abortAll");
    for (const live of this.live.values()) live.control.abort();
  }

  async drain(): Promise<void> {
    Trace.line(import.meta.url, "LiveRuns.drain");
    await Promise.allSettled([...this.live.values()].map((live) => live.done));
    this.live.clear();
  }

  has(runId: string): boolean {
    Trace.line(import.meta.url, "LiveRuns.has", { runId });
    return this.live.has(runId);
  }

  async waitFor(runId: string): Promise<void> {
    Trace.line(import.meta.url, "LiveRuns.waitFor", { runId });
    await this.live.get(runId)?.done;
  }

  controllable(runId: string): Live {
    Trace.line(import.meta.url, "LiveRuns.controllable", { runId });
    const live = this.live.get(runId);
    if (!live) throw new RunError(`run ${runId} is not running here`);
    const status = this.store.getRun(runId)?.status;
    if (status && TERMINAL_STATUSES.has(status)) {
      throw new RunError(`run ${runId} has already finished (${status})`);
    }
    return live;
  }

  subscribe(runId: string, subscriber: Subscriber): (() => void) | null {
    Trace.line(import.meta.url, "LiveRuns.subscribe", { runId, subscriber });
    const live = this.live.get(runId);
    if (!live) return null;
    live.subscribers.add(subscriber);
    return () => live.subscribers.delete(subscriber);
  }

  emit(runId: string, kind: string, payload: Record<string, unknown>): void {
    Trace.tick(import.meta.url, "LiveRuns.emit", { kind });
    const event = this.store.addEvent(runId, kind, payload);
    const live = this.live.get(runId);
    if (!live) return;
    const frame: EventFrame = {
      id: event.id,
      kind,
      payload,
      created_at: event.created_at,
    };
    this.deliver(live, frame);
  }

  closeSubscribers(runId: string): void {
    Trace.line(import.meta.url, "LiveRuns.closeSubscribers", { runId });
    const live = this.live.get(runId);
    if (live) this.deliver(live, null);
  }

  private deliver(live: Live, frame: EventFrame | null): void {
    Trace.tick(import.meta.url, "LiveRuns.deliver", { kind: frame?.kind ?? "end" });
    for (const subscriber of [...live.subscribers]) {
      LiveRuns.bestEffort(subscriber, frame);
    }
  }

  private static bestEffort(subscriber: Subscriber, frame: EventFrame | null): void {
    Trace.tick(import.meta.url, "LiveRuns.bestEffort", { kind: frame?.kind ?? "end" });
    try {
      subscriber(frame);
    } catch {
      return;
    }
  }
}
