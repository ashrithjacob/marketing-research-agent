import type { Hono } from "hono";

import { RunError, type ReviewAnalyst, type RunSupervisor } from "../agent/index.js";
import type { ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** A review-mining run's review analysis: read where it stands, or start it. */
export class ReviewAnalysisRoutes {
  constructor(
    private readonly store: ResearchStore,
    private readonly supervisor: RunSupervisor,
    private readonly analyst: ReviewAnalyst,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "ReviewAnalysisRoutes.register");
    api.get("/runs/:runId/review-analysis", async (c) => {
      const runId = c.req.param("runId");
      if (!(await this.store.getRun(runId))) return c.json({ detail: "no such run" }, 404);
      return c.json({ analysis: await this.analyst.read(runId) });
    });
    api.post("/runs/:runId/review-analysis", async (c) => {
      const run = await this.store.getRun(c.req.param("runId"));
      if (!run) return c.json({ detail: "no such run" }, 404);
      if (run.stage !== 3) return c.json({ detail: "review analysis is for review-mining runs" }, 409);
      if (this.supervisor.isLive(run.id)) return c.json({ detail: "the run is still mining reviews" }, 409);
      try {
        return c.json({ analysis: await this.analyst.start(run) }, 202);
      } catch (error) {
        if (!(error instanceof RunError)) throw error;
        return c.json({ detail: error.message }, 409);
      }
    });
  }
}
