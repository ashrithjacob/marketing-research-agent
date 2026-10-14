import type { Context, Hono } from "hono";

import { RunError, type PlaybookDesk } from "../agent/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** Playbooks (spec §5.4–5.8): each with its versions' numbers and flag, rollback to an older version, restoring an archived one, and distilling one from a library document. */
export class PlaybookRoutes {
  constructor(private readonly desk: PlaybookDesk) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "PlaybookRoutes.register");
    api.get("/playbooks", (c) => this.answer(c, 200, () => this.desk.list(PlaybookRoutes.workspace(c))));
    api.post("/playbooks/:key/rollback", (c) => this.answer(c, 200, async (body) => this.desk.rollback(PlaybookRoutes.workspace(c), c.req.param("key"), Number((body as { version?: unknown } | null)?.version))));
    api.post("/playbooks/:key/restore", (c) => this.answer(c, 200, async () => ({ ok: (await this.desk.restore(PlaybookRoutes.workspace(c), c.req.param("key")), true) })));
    api.post("/library/:documentId/distil", (c) => this.answer(c, 202, () => this.desk.distil(PlaybookRoutes.workspace(c), c.req.param("documentId"))));
  }

  private async answer(c: Context<ApiEnv>, status: 200 | 202, work: (body: unknown) => Promise<unknown>) {
    Trace.line(import.meta.url, "PlaybookRoutes.answer", { path: c.req.path });
    try {
      const body = c.req.method === "POST" ? await c.req.json().catch(() => null) : null;
      return c.json(await work(body), status);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 400);
    }
  }

  private static workspace(c: Context<ApiEnv>): string {
    Trace.line(import.meta.url, "PlaybookRoutes.workspace");
    return c.get("principal").workspaceId;
  }
}
