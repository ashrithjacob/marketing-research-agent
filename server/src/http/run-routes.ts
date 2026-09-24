import type { Context, Hono } from "hono";

import { RunError, RunSupervisor, type StageTwoHandoff } from "../agent/index.js";
import {
  Briefs,
  type ResearchStore,
  Runs,
  Stages,
  judgementInSchema,
  runRequestSchema,
} from "../domain/index.js";

import { CallStats } from "./call-stats.js";

/** The run lifecycle endpoints: create, list, read, steer, stop, and the call log. */
export class RunRoutes {
  constructor(
    private readonly store: ResearchStore,
    private readonly supervisor: RunSupervisor,
    private readonly handoff: StageTwoHandoff,
  ) {}

  register(api: Hono): void {
    api.get("/runs", (c) => {
      const limit = Number(c.req.query("limit") ?? 50);
      const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
      return c.json({ data: this.store.listRuns(safeLimit).map(Runs.summary) });
    });
    api.post("/runs", async (c) => this.create(c));
    api.get("/runs/:runId", (c) => {
      const run = this.store.getRun(c.req.param("runId"));
      if (!run) return c.json({ detail: "no such run" }, 404);
      return c.json({
        ...Runs.summary(run),
        packet: run.packet,
        output: run.output,
        reject_kinds: run.reject_kinds,
        live: this.supervisor.isLive(run.id),
      });
    });
    api.get("/runs/:runId/calls", (c) => this.calls(c, c.req.param("runId")));
    api.post("/runs/:runId/steer", async (c) => this.steer(c, c.req.param("runId")));
    api.post("/runs/:runId/stop", (c) => {
      const runId = c.req.param("runId");
      if (!this.store.getRun(runId)) return c.json({ detail: "no such run" }, 404);
      try {
        this.supervisor.stop(runId);
      } catch (error) {
        if (!(error instanceof RunError)) throw error;
        return c.json({ detail: error.message }, 409);
      }
      return c.json({ ok: true });
    });
  }

  private async create(c: Context) {
    const parsed = runRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ detail: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
    }
    const brief = Briefs.normalise(parsed.data.brief);
    if (!brief.product && !brief.url) {
      return c.json({ detail: "brief.product or brief.url is required" }, 400);
    }
    const nodes = Stages.expand(parsed.data.nodes);
    if ((Stages.covering(nodes) ?? 1) === 2) {
      const source = this.handoff.forBrief(brief);
      if (!source) {
        return c.json(
          {
            detail:
              "review mining is stage 2: run stage 1 for this brief first, and let it " +
              "complete — its packet names the listings stage 2 mines. No stage-1 packet " +
              "exists for this subject yet.",
          },
          409,
        );
      }
    }

    let runId: string;
    try {
      runId = this.supervisor.start({ ...parsed.data, brief });
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 502);
    }
    const run = this.store.getRun(runId);
    return c.json(run ? Runs.summary(run) : { detail: "run vanished" }, run ? 200 : 500);
  }

  private calls(c: Context, runId: string) {
    const run = this.store.getRun(runId);
    if (!run) return c.json({ detail: "no such run" }, 404);
    const after = Number(c.req.query("after") ?? 0);
    const calls = this.store.listLlmCalls(run.id);
    const live = this.supervisor.isLive(run.id);
    return c.json({
      run: { ...Runs.summary(run), live },
      stats: CallStats.of(run, calls, this.store.listEvents(run.id), live),
      calls:
        Number.isFinite(after) && after > 0 ? calls.filter((call) => call.seq > after) : calls,
    });
  }

  private async steer(c: Context, runId: string) {
    if (!this.store.getRun(runId)) return c.json({ detail: "no such run" }, 404);
    const parsed = judgementInSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success || !parsed.data.text.trim()) {
      return c.json({ detail: "judgement text is required" }, 400);
    }
    const judgement = this.store.addJudgement({
      kind: parsed.data.kind,
      text: parsed.data.text.trim(),
      rejects_kinds: parsed.data.rejects_kinds,
    });
    try {
      this.supervisor.steer(runId, judgement);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 409);
    }
    return c.json(judgement);
  }
}
