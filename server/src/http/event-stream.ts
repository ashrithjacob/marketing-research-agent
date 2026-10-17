import type { Context } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";

import type { RunEvents } from "../agent/index.js";
import { FINAL_RUN_STATUSES, type ResearchStore, type RunEvent } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** Replays a run's stored events after `after`, then follows it live until it ends; subscribing before replaying closes the gap between the two. */
export class EventStream {
  static readonly KEEPALIVE_MS = 20_000;

  constructor(
    private readonly store: ResearchStore,
    private readonly events: RunEvents,
  ) {}

  open(c: Context<ApiEnv>, runId: string): Response {
    Trace.line(import.meta.url, "EventStream.open", { runId });
    const after = Number(c.req.query("after") ?? 0);
    return streamSSE(c, (stream) => this.follow(stream, runId, Number.isFinite(after) ? after : 0));
  }

  private async follow(stream: SSEStreamingApi, runId: string, after: number): Promise<void> {
    Trace.line(import.meta.url, "EventStream.follow", { runId, after });
    const pending: RunEvent[] = [];
    let wake: (() => void) | null = null;
    const unsubscribe = this.events.subscribe(runId, (event) => {
      pending.push(event);
      wake?.();
    });
    let last = after;
    try {
      pending.unshift(...(await this.store.events.list(runId, after)));
      for (;;) {
        for (let event = pending.shift(); event; event = pending.shift()) {
          if (event.id <= last) continue;
          last = event.id;
          await stream.writeSSE({ event: "event", id: String(event.id), data: JSON.stringify(event) });
        }
        const run = await this.store.runs.get(runId);
        if (!run || (FINAL_RUN_STATUSES.has(run.status) && pending.length === 0)) break;
        const woken = await new Promise<boolean>((resolve) => {
          wake = () => resolve(true);
          setTimeout(() => resolve(false), EventStream.KEEPALIVE_MS);
        });
        wake = null;
        if (!woken) await stream.writeSSE({ event: "keepalive", data: "" });
      }
      await stream.writeSSE({ event: "end", data: JSON.stringify({ reason: "run ended" }) });
    } finally {
      unsubscribe();
    }
  }
}
