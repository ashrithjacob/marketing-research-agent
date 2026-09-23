import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { SSEStreamingApi } from "hono/streaming";

import type { EventFrame, RunSupervisor } from "../agent/index.js";
import type { ResearchStore } from "../domain/index.js";

/** Replay from `after`, then follow live; subscribing before replaying closes the gap. */
export class EventStream {
  constructor(
    private readonly store: ResearchStore,
    private readonly supervisor: RunSupervisor,
  ) {}

  register(api: Hono): void {
    api.get("/runs/:runId/events", (c) => {
      const runId = c.req.param("runId");
      if (!this.store.getRun(runId)) return c.json({ detail: "no such run" }, 404);
      const after = Number(c.req.query("after") ?? 0);
      const from = Number.isFinite(after) ? after : 0;
      return streamSSE(c, async (stream) => this.follow(stream, runId, from));
    });
  }

  private async follow(stream: SSEStreamingApi, runId: string, from: number): Promise<void> {
    const pending: Array<EventFrame | null> = [];
    let wake: (() => void) | null = null;
    const unsubscribe = this.supervisor.subscribe(runId, (frame) => {
      pending.push(frame);
      wake?.();
    });

    let last = from;
    try {
      for (const event of this.store.listEvents(runId, last)) {
        last = event.id;
        await stream.writeSSE({
          event: "event",
          data: JSON.stringify({
            id: event.id,
            kind: event.kind,
            payload: event.payload,
            created_at: event.created_at,
          }),
        });
      }
      if (!unsubscribe) {
        await stream.writeSSE({ event: "end", data: JSON.stringify({ reason: "not live" }) });
        return;
      }
      for (;;) {
        if (pending.length === 0) {
          const woken = await Promise.race([
            new Promise<boolean>((r) => {
              wake = () => r(true);
            }),
            new Promise<boolean>((r) => setTimeout(() => r(false), 20000)),
          ]);
          wake = null;
          if (!woken) {
            await stream.writeSSE({ event: "keepalive", data: "" });
            continue;
          }
        }
        const frame = pending.shift();
        if (frame === undefined) continue;
        if (frame === null) {
          await stream.writeSSE({
            event: "end",
            data: JSON.stringify({ reason: "run finished" }),
          });
          return;
        }
        if (frame.id <= last) continue;
        last = frame.id;
        await stream.writeSSE({ event: "event", data: JSON.stringify(frame) });
      }
    } finally {
      unsubscribe?.();
    }
  }
}
