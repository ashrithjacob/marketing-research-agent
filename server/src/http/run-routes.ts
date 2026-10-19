import { Hono, type Context } from "hono";

import type { AnalysisService, RunEvents } from "../agent/index.js";
import { Scope, type ResearchStore, type Run } from "../domain/index.js";
import { Trace, type TraceFile } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";
import { EventStream } from "./event-stream.js";

/** Runs: start one, read it with its product and competitors, confirm what it resolved, stop it, follow its events, read what it spent and its trace. */
export class RunRoutes {
  private readonly stream: EventStream;

  constructor(
    private readonly store: ResearchStore,
    private readonly analyses: AnalysisService,
    events: RunEvents,
    private readonly traces: TraceFile,
  ) {
    Trace.line(import.meta.url, "RunRoutes.constructor");
    this.stream = new EventStream(store, events);
  }

  router(): Hono<ApiEnv> {
    Trace.line(import.meta.url, "RunRoutes.router");
    const api = new Hono<ApiEnv>();
    api.get("/runs", async (c) => c.json({ runs: await this.store.runs.summaries(Scope.forViewer(c.get("principal"))) }));
    api.post("/runs", async (c) => {
      const started = await this.analyses.start(c.get("principal").accountId, await c.req.json().catch(() => null));
      return "refused" in started ? c.json({ detail: started.refused }, 422) : c.json({ run: started }, 201);
    });
    api.get("/runs/:runId", async (c) => this.withRun(c, async (run) => c.json(await this.view(run))));
    api.post("/runs/:runId/confirm", async (c) =>
      this.withRun(c, async (run) => {
        const confirmed = await this.analyses.confirm(run, await c.req.json().catch(() => null));
        return "refused" in confirmed ? c.json({ detail: confirmed.refused }, 422) : c.json(await this.view(confirmed));
      }),
    );
    api.post("/runs/:runId/stop", async (c) =>
      this.withRun(c, async (run) => {
        await this.analyses.stop(run);
        return c.json({ ok: true });
      }),
    );
    api.get("/runs/:runId/events", async (c) => this.withRun(c, async (run) => this.stream.open(c, run.id)));
    api.get("/runs/:runId/charges", async (c) => this.withRun(c, async (run) => c.json({ charges: await this.store.charges.list(run.id) })));
    api.get("/runs/:runId/trace", async (c) => this.withRun(c, async (run) => this.trace(c, run.id)));
    api.get("/runs/:runId/calls", async (c) => this.withRun(c, async (run) => c.json({ calls: await this.store.calls.list(run.id) })));
    return api;
  }

  private async withRun(c: Context<ApiEnv>, work: (run: Run) => Promise<Response>): Promise<Response> {
    Trace.line(import.meta.url, "RunRoutes.withRun", { runId: c.req.param("runId") });
    const run = await this.analyses.get(c.req.param("runId") ?? "", Scope.forViewer(c.get("principal")));
    return run ? work(run) : c.json({ detail: "no such run" }, 404);
  }

  private trace(c: Context<ApiEnv>, runId: string): Response {
    Trace.line(import.meta.url, "RunRoutes.trace", { runId });
    const text = this.traces.read(runId);
    if (text === null) return c.json({ detail: "no trace for this run" }, 404);
    return c.body(text, 200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="run-${runId}-trace.log"`,
      "X-Content-Type-Options": "nosniff",
    });
  }

  private async view(run: Run): Promise<Record<string, unknown>> {
    Trace.line(import.meta.url, "RunRoutes.view", { runId: run.id });
    const product = run.product_id ? await this.store.products.get(run.product_id) : null;
    const competitors = run.product_id ? (await this.store.competitors.list(run.product_id)).filter((competitor) => competitor.status === "confirmed") : [];
    const urls = [run.resolution?.product.url, ...(run.resolution?.alternatives ?? []).map((a) => a.url), ...(run.resolution?.competitors ?? []).map((c) => c.url), product?.url, ...competitors.map((c) => c.url)];
    const visuals = Object.fromEntries(await this.store.visuals.get([...new Set(urls.filter((url): url is string => Boolean(url)))]));
    return { run, product, competitors, visuals };
  }
}
