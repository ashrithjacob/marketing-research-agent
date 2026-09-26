import type { Hono } from "hono";

import { Trace, type TraceFile } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** One run's trace file, as a download. Scoped to the caller's workspace by ScopeGuard. */
export class TraceRoute {
  constructor(private readonly traces: TraceFile) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "TraceRoute.register");
    api.get("/runs/:runId/trace", (c) => {
      const runId = c.req.param("runId");
      const text = this.traces.read(runId);
      if (text === null) return c.json({ detail: "no trace for this run" }, 404);
      return c.body(text, 200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="run-${runId}-trace.log"`,
        "X-Content-Type-Options": "nosniff",
      });
    });
  }
}
