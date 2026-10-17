import type { Hono } from "hono";

import { RunError, type RunSupervisor } from "../agent/index.js";
import type { ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** Rewrites a finished market-truth run's gate for the owner: the backfill for a run that ended before runs did this themselves. */
export class RewordRoute {
  constructor(
    private readonly store: ResearchStore,
    private readonly supervisor: RunSupervisor,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "RewordRoute.register");
    api.post("/runs/:runId/reword", async (c) => {
      const runId = c.req.param("runId");
      if (!(await this.store.getRun(runId))) return c.json({ detail: "no such run" }, 404);
      if (this.supervisor.isLive(runId)) return c.json({ detail: "the run is still in progress" }, 409);
      try {
        return c.json({ reworded: await this.supervisor.reword(runId) });
      } catch (error) {
        if (error instanceof RunError) return c.json({ detail: error.message }, 409);
        return c.json({ detail: `the judge model did not rewrite the gate: ${error instanceof Error ? error.message : String(error)}` }, 502);
      }
    });
  }
}
