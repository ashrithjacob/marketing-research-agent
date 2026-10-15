import type { Context, Hono } from "hono";

import { RunError, type OwnerDesk } from "../agent/index.js";
import { Scope, type PlanBook } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** Start, review and chat: a plan from a brief, its tasks toggled, its approval, and a message to the operator. Nothing here waits for work. */
export class WorkspaceRoutes {
  constructor(
    private readonly owner: OwnerDesk,
    private readonly plans: PlanBook,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "WorkspaceRoutes.register");
    api.post("/plans", (c) => this.answer(c, 201, async (workspace) => this.owner.start(await c.req.json().catch(() => null), workspace)));
    api.get("/plans/:planId", async (c) => {
      const plan = await this.plans.get(Scope.forViewer(c.get("principal")), c.req.param("planId"));
      return plan ? c.json(plan) : c.json({ detail: "no such plan" }, 404);
    });
    api.post("/plans/:planId/tasks/:key", (c) =>
      this.answer(c, 200, async () => {
        const body = (await c.req.json().catch(() => null)) as { selected?: unknown; stop_when?: unknown } | null;
        const change = {
          ...(typeof body?.selected === "boolean" ? { selected: body.selected } : {}),
          ...(typeof body?.stop_when === "string" ? { stop_when: body.stop_when } : {}),
        };
        return this.owner.edit(c.req.param("planId"), Scope.forViewer(c.get("principal")), c.req.param("key"), change);
      }),
    );
    api.post("/plans/:planId/stages/:stage", (c) =>
      this.answer(c, 200, async () => {
        const body = (await c.req.json().catch(() => null)) as { selected?: unknown; landed_unit_cost?: unknown; currency?: unknown } | null;
        const change = {
          selected: body?.selected === true,
          ...(typeof body?.landed_unit_cost === "number" ? { landed_unit_cost: body.landed_unit_cost } : {}),
          ...(typeof body?.currency === "string" ? { currency: body.currency } : {}),
        };
        return this.owner.stage(c.req.param("planId"), Scope.forViewer(c.get("principal")), Number(c.req.param("stage")), change);
      }),
    );
    api.post("/plans/:planId/approve", (c) => this.answer(c, 202, () => this.owner.approve(c.req.param("planId"), Scope.forViewer(c.get("principal")))));
    api.post("/chat", (c) =>
      this.answer(c, 202, async (workspace) => {
        const body = (await c.req.json().catch(() => null)) as { text?: unknown; plan_id?: unknown } | null;
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) throw new RunError("say something: { text }");
        await this.owner.say(workspace, text, typeof body?.plan_id === "string" ? body.plan_id : "");
        return { ok: true };
      }),
    );
  }

  private async answer(c: Context<ApiEnv>, status: 200 | 201 | 202, work: (workspace: string) => Promise<unknown>) {
    Trace.line(import.meta.url, "WorkspaceRoutes.answer", { path: c.req.path });
    try {
      return c.json(await work(c.get("principal").workspaceId), status);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 400);
    }
  }
}
