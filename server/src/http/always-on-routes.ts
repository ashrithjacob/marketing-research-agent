import type { Context, Hono } from "hono";

import { RunError, type AlwaysOnDesk, type ScheduleDesk } from "../agent/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** The Always on switch with its daily cap, and the owner's schedules. */
export class AlwaysOnRoutes {
  constructor(
    private readonly alwaysOn: AlwaysOnDesk,
    private readonly schedules: ScheduleDesk,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "AlwaysOnRoutes.register");
    api.get("/always-on", async (c) => c.json(await this.alwaysOn.status(c.get("principal").workspaceId)));
    api.post("/always-on", (c) =>
      this.answer(c, async (workspace) => {
        const body = (await c.req.json().catch(() => null)) as { on?: unknown; daily_cap_usd?: unknown } | null;
        return this.alwaysOn.set(workspace, body?.on === true, typeof body?.daily_cap_usd === "number" ? body.daily_cap_usd : null);
      }),
    );
    api.get("/schedules", async (c) => c.json({ data: await this.schedules.list(c.get("principal").workspaceId) }));
    api.post("/schedules", (c) =>
      this.answer(c, async (workspace) => {
        const body = (await c.req.json().catch(() => null)) as { task_key?: unknown; every_days?: unknown; brief?: unknown } | null;
        return this.schedules.add(workspace, String(body?.task_key ?? ""), Number(body?.every_days), body?.brief);
      }),
    );
    api.delete("/schedules/:scheduleId", (c) => this.answer(c, async (workspace) => (await this.schedules.remove(workspace, c.req.param("scheduleId")), { ok: true })));
  }

  private async answer(c: Context<ApiEnv>, work: (workspace: string) => Promise<unknown>) {
    Trace.line(import.meta.url, "AlwaysOnRoutes.answer", { path: c.req.path });
    try {
      return c.json(await work(c.get("principal").workspaceId));
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 400);
    }
  }
}
