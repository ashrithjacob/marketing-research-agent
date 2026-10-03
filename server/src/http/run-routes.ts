import type { Context, Hono } from "hono";

import { RunError, RunSupervisor, type StageOneHandoff, type ReviewMiningListings } from "../agent/index.js";
import { ReviewMiningRoster } from "../extract/index.js";
import { Briefs, Runs, Scope, Stages, judgementInSchema, runRequestSchema, stagePacketSchema, type Brief, type ResearchRun, type ResearchStore, type TargetListing } from "../domain/index.js";

import { CallStats } from "./call-stats.js";
import type { ApiEnv } from "./api-env.js";
import { Trace } from "../trace/index.js";

/** The run lifecycle endpoints: create, list, read, steer, stop, and the call log. */
export class RunRoutes {
  constructor(
    private readonly store: ResearchStore,
    private readonly supervisor: RunSupervisor,
    private readonly handoff: StageOneHandoff,
    private readonly listings: ReviewMiningListings,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "RunRoutes.register");
    api.get("/runs", async (c) => {
      const limit = Number(c.req.query("limit") ?? 50);
      const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
      const scope = Scope.forViewer(c.get("principal"));
      return c.json({ data: (await this.store.listRuns(scope, safeLimit)).map(Runs.summary) });
    });
    api.post("/runs", async (c) => this.create(c));
    api.get("/runs/:runId", async (c) => {
      const run = await this.store.getRun(c.req.param("runId"));
      if (!run) return c.json({ detail: "no such run" }, 404);
      return c.json({
        ...Runs.summary(run),
        packet: run.packet,
        output: run.output,
        reject_kinds: run.reject_kinds,
        listings: await this.judgedListings(run),
        live: this.supervisor.isLive(run.id),
        last_event_id: await this.store.lastEventId(run.id),
      });
    });
    api.get("/runs/:runId/calls", (c) => this.calls(c, c.req.param("runId")));
    api.post("/runs/:runId/steer", async (c) => this.steer(c, c.req.param("runId")));
    api.post("/runs/:runId/stop", async (c) => {
      const runId = c.req.param("runId");
      if (!(await this.store.getRun(runId))) return c.json({ detail: "no such run" }, 404);
      try {
        await this.supervisor.stop(runId);
      } catch (error) {
        if (!(error instanceof RunError)) throw error;
        return c.json({ detail: error.message }, 409);
      }
      return c.json({ ok: true });
    });
  }

  private async create(c: Context<ApiEnv>) {
    Trace.line(import.meta.url, "RunRoutes.create");
    const { workspaceId } = c.get("principal");
    const parsed = runRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ detail: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
    }
    const brief = Briefs.normalise(parsed.data.brief);
    if (!brief.product && !brief.url) {
      return c.json({ detail: "brief.product or brief.url is required" }, 400);
    }
    const refused = await this.unready(Stages.covering(Stages.expand(parsed.data.nodes)) ?? 1, brief, workspaceId);
    if (refused) return c.json({ detail: refused }, 409);

    let runId: string;
    try {
      runId = await this.supervisor.start({ ...parsed.data, brief }, workspaceId);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 502);
    }
    const run = await this.store.getRun(runId);
    return c.json(run ? Runs.summary(run) : { detail: "run vanished" }, run ? 200 : 500);
  }

  /** Why a stage cannot start yet: product truth reads a completed stage 1, and review mining also needs product truth complete on that same stage-1 run. */
  private async unready(stage: number, brief: Brief, workspaceId: string): Promise<string | null> {
    Trace.line(import.meta.url, "RunRoutes.unready", { stage });
    if (stage === 1) return null;
    const source = await this.handoff.forBrief(brief, Scope.of(workspaceId));
    if (!source) {
      return `stage ${stage} builds on stage 1: run stage 1 for this brief first, and let it complete. ` +
        "No completed stage-1 packet exists for this subject yet.";
    }
    if (stage === 3 && !(await this.handoff.hasCompleted(2, source.run.id, Scope.of(workspaceId)))) {
      return `review mining is stage 3: it starts once product truth (stage 2) has completed on stage-1 run ${source.run.id.slice(0, 8)}, ` +
        "the run whose listings it mines.";
    }
    return null;
  }

  private async calls(c: Context<ApiEnv>, runId: string) {
    Trace.line(import.meta.url, "RunRoutes.calls", { runId });
    const run = await this.store.getRun(runId);
    if (!run) return c.json({ detail: "no such run" }, 404);
    const after = Number(c.req.query("after") ?? 0);
    const calls = await this.store.listLlmCalls(run.id);
    const live = this.supervisor.isLive(run.id);
    return c.json({
      run: { ...Runs.summary(run), live },
      stats: CallStats.of(run, calls, await this.store.listEvents(run.id), live),
      calls:
        Number.isFinite(after) && after > 0 ? calls.filter((call) => call.seq > after) : calls,
    });
  }

  private async steer(c: Context<ApiEnv>, runId: string) {
    Trace.line(import.meta.url, "RunRoutes.steer", { runId });
    const run = await this.store.getRun(runId);
    if (!run) return c.json({ detail: "no such run" }, 404);
    const parsed = judgementInSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success || !parsed.data.text.trim()) {
      return c.json({ detail: "judgement text is required" }, 400);
    }
    const judgement = await this.store.addJudgement(run.workspace_id, {
      kind: parsed.data.kind,
      text: parsed.data.text.trim(),
      rejects_kinds: parsed.data.rejects_kinds,
    });
    try {
      await this.supervisor.steer(runId, judgement);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 409);
    }
    return c.json(judgement);
  }

  private async judgedListings(run: ResearchRun): Promise<TargetListing[]> {
    Trace.line(import.meta.url, "RunRoutes.judgedListings", { runId: run.id });
    const packet = stagePacketSchema.safeParse(run.packet);
    if (!packet.success || packet.data.stage !== 1) return [];
    return this.listings.judged(run.id, ReviewMiningRoster.of(packet.data));
  }
}
