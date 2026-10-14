import type { Context, Hono } from "hono";

import { RunError, type DraftDesk, type DraftFlow } from "../agent/index.js";
import { Scope, type DraftSection } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** Drafts (spec §3.1, `write`): started from a plan, read with their citations, edited section by section, approved or rejected by the owner. */
export class DraftRoutes {
  constructor(
    private readonly flow: DraftFlow,
    private readonly desk: DraftDesk,
    private readonly drafts: { list(scope: Scope, limit: number): Promise<unknown[]> },
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "DraftRoutes.register");
    api.get("/drafts", async (c) => c.json({ data: await this.drafts.list(DraftRoutes.scope(c), 50) }));
    api.get("/drafts/:draftId", (c) => this.answer(c, 200, () => this.desk.view(c.req.param("draftId"), DraftRoutes.scope(c))));
    api.post("/plans/:planId/write", (c) => this.answer(c, 202, async (body) => this.flow.write(c.req.param("planId"), DraftRoutes.scope(c), DraftRoutes.field(body, "playbook") || "long_form_static")));
    api.post("/drafts/:draftId/edit", (c) => this.answer(c, 200, async (body) => this.desk.edit(c.req.param("draftId"), DraftRoutes.scope(c), DraftRoutes.sections(body))));
    api.post("/drafts/:draftId/approve", (c) => this.answer(c, 200, () => this.desk.approve(c.req.param("draftId"), DraftRoutes.scope(c))));
    api.post("/drafts/:draftId/reject", (c) => this.answer(c, 200, async (body) => this.desk.reject(c.req.param("draftId"), DraftRoutes.scope(c), DraftRoutes.field(body, "why"))));
  }

  private async answer(c: Context<ApiEnv>, status: 200 | 202, work: (body: unknown) => Promise<unknown>) {
    Trace.line(import.meta.url, "DraftRoutes.answer", { path: c.req.path });
    try {
      const body = c.req.method === "POST" ? await c.req.json().catch(() => null) : null;
      return c.json(await work(body), status);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 400);
    }
  }

  private static scope(c: Context<ApiEnv>): Scope {
    Trace.line(import.meta.url, "DraftRoutes.scope");
    return Scope.forViewer(c.get("principal"));
  }

  private static field(body: unknown, key: string): string {
    Trace.line(import.meta.url, "DraftRoutes.field", { key });
    const value = (body as Record<string, unknown> | null)?.[key];
    return typeof value === "string" ? value : "";
  }

  private static sections(body: unknown): DraftSection[] {
    Trace.line(import.meta.url, "DraftRoutes.sections");
    const sections = (body as { sections?: unknown } | null)?.sections;
    if (!Array.isArray(sections)) throw new RunError("sections must be a list of { key, text }");
    return sections.filter((s): s is DraftSection => typeof s?.key === "string" && typeof s?.text === "string");
  }
}
