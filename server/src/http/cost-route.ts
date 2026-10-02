import type { Hono } from "hono";

import type { ResearchStore } from "../domain/index.js";
import { CostReports } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** `GET /runs/:runId/costs` — what each agent, and the run itself, spent per service. */
export class CostRoute {
  constructor(private readonly store: ResearchStore) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "CostRoute.register");
    api.get("/runs/:runId/costs", (c) => {
      const runId = c.req.param("runId");
      return c.json(CostReports.of(this.store.listLlmCalls(runId), this.store.charges.list(runId)));
    });
  }
}
