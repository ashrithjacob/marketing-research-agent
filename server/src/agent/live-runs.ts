import type { Agent } from "@earendil-works/pi-agent-core";

import { TERMINAL_STATUSES, type ResearchStore } from "../domain/index.js";

import { RunError } from "./errors.js";
import type { EventFrame } from "./frames.js";

export type Subscriber = (frame: EventFrame | null) => void;

export interface Live {
  agent: Agent;
  subscribers: Set<Subscriber>;
  done: Promise<void>;
}

/** The runs in flight in this process, and the browsers watching them. */
export class LiveRuns {
  private readonly live = new Map<string, Live>();

  constructor(private readonly store: ResearchStore) {}

  add(runId: string, live: Live): void {
    this.live.set(runId, live);
  }

  remove(runId: string): void {
    this.live.delete(runId);
  }

  get(runId: string): Live | undefined {
    return this.live.get(runId);
  }

  ids(): string[] {
    return [...this.live.keys()];
  }

  abortAll(): void {
    for (const live of this.live.values()) live.agent.abort();
  }

  async drain(): Promise<void> {
    await Promise.allSettled([...this.live.values()].map((live) => live.done));
    this.live.clear();
  }

  has(runId: string): boolean {
    return this.live.has(runId);
  }

  async waitFor(runId: string): Promise<void> {
    await this.live.get(runId)?.done;
  }

  controllable(runId: string): Live {
    const live = this.live.get(runId);
    if (!live) throw new RunError(`run ${runId} is not running here`);
    const status = this.store.getRun(runId)?.status;
    if (status && TERMINAL_STATUSES.has(status)) {
      throw new RunError(`run ${runId} has already finished (${status})`);
    }
    return live;
  }

  subscribe(runId: string, subscriber: Subscriber): (() => void) | null {
    const live = this.live.get(runId);
    if (!live) return null;
    live.subscribers.add(subscriber);
    return () => live.subscribers.delete(subscriber);
  }

  emit(runId: string, kind: string, payload: Record<string, unknown>): void {
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
    const live = this.live.get(runId);
    if (live) this.deliver(live, null);
  }

  private deliver(live: Live, frame: EventFrame | null): void {
    for (const subscriber of [...live.subscribers]) {
      LiveRuns.bestEffort(subscriber, frame);
    }
  }

  private static bestEffort(subscriber: Subscriber, frame: EventFrame | null): void {
    try {
      subscriber(frame);
    } catch {
      return;
    }
  }
}
