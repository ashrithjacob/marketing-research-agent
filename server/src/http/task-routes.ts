import type { Context, Hono } from "hono";

import { RunError, type TaskSupervisor } from "../agent/index.js";
import { Runs, Scope, type ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** Durable tasks: start one from a contract, and stop one. A task's run is read through the run routes like any other. */
export class TaskRoutes {
  constructor(
    private readonly store: ResearchStore,
    private readonly tasks: TaskSupervisor,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "TaskRoutes.register");
    api.post("/tasks", (c) => this.start(c));
    api.post("/tasks/:runId/stop", (c) => this.stop(c, c.req.param("runId")));
    api.post("/tasks/:runId/answer", (c) => this.answer(c, c.req.param("runId")));
  }

  private async start(c: Context<ApiEnv>) {
    Trace.line(import.meta.url, "TaskRoutes.start");
    const { workspaceId } = c.get("principal");
    try {
      const run = await this.tasks.start(await c.req.json().catch(() => null), workspaceId);
      return c.json(Runs.summary(run), 202);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 400);
    }
  }

  private async answer(c: Context<ApiEnv>, runId: string) {
    Trace.line(import.meta.url, "TaskRoutes.answer", { runId });
    const run = await this.store.getRun(runId);
    if (!run || !Scope.forViewer(c.get("principal")).admits(run.workspace_id)) return c.json({ detail: "no such run" }, 404);
    const body = (await c.req.json().catch(() => null)) as { answer?: unknown } | null;
    const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
    if (!answer) return c.json({ detail: "give the answer: { answer }" }, 400);
    try {
      await this.tasks.answer(runId, answer);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 409);
    }
    return c.json({ ok: true }, 202);
  }

  private async stop(c: Context<ApiEnv>, runId: string) {
    Trace.line(import.meta.url, "TaskRoutes.stop", { runId });
    const run = await this.store.getRun(runId);
    if (!run || !Scope.forViewer(c.get("principal")).admits(run.workspace_id)) return c.json({ detail: "no such run" }, 404);
    if (!run.contract) return c.json({ detail: "this run is not a task; stop it with /runs/:runId/stop" }, 409);
    await this.tasks.stop(runId);
    return c.json({ ok: true });
  }
}
