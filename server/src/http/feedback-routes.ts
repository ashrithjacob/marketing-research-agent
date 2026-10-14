import type { Hono } from "hono";

import { FeedbackStrengths, Scope, type ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** Feedback the owner gives outside a plan or a card: a source marked wrong on a run's page. And the list of everything recorded. */
export class FeedbackRoutes {
  constructor(private readonly store: ResearchStore) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "FeedbackRoutes.register");
    api.get("/feedback", async (c) => c.json({ data: await this.store.feedback.list(Scope.forViewer(c.get("principal")), 100) }));
    api.post("/runs/:runId/sources/:sourceId/wrong", async (c) => {
      const runId = c.req.param("runId");
      const sourceId = decodeURIComponent(c.req.param("sourceId"));
      const run = await this.store.getRun(runId);
      if (!run || !Scope.forViewer(c.get("principal")).admits(run.workspace_id)) return c.json({ detail: "no such run" }, 404);
      const known = (await this.store.findings.list(runId)).some((row) => row.kind === "source" && row.payload.id === sourceId);
      if (!known) return c.json({ detail: `run ${runId} recorded no source ${sourceId}` }, 404);
      const body = (await c.req.json().catch(() => null)) as { why?: unknown } | null;
      const why = typeof body?.why === "string" ? body.why.trim() : "";
      const target = FeedbackStrengths.target("source", sourceId, { run_id: runId });
      return c.json(await this.store.feedback.record(run.workspace_id, { verdict: "reject", target, text: why }), 201);
    });
  }
}
