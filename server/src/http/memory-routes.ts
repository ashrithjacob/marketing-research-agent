import type { Context, Hono } from "hono";

import { RunError, type MemoryDesk } from "../agent/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** Brand memory as the owner sees and edits it (spec §5.4): every entry listed, and each add, change or delete a new version. */
export class MemoryRoutes {
  constructor(private readonly memory: MemoryDesk) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "MemoryRoutes.register");
    api.get("/memory", async (c) => c.json({ data: await this.memory.list(c.get("principal").workspaceId) }));
    api.post("/memory", (c) => this.write(c, 201, async (body) => ({ text: MemoryRoutes.text(body) })));
    api.post("/memory/:entryId", (c) => this.write(c, 200, async (body) => ({ entry_id: c.req.param("entryId"), text: MemoryRoutes.text(body) })));
    api.delete("/memory/:entryId", (c) => this.write(c, 200, async () => ({ entry_id: c.req.param("entryId"), deleted: true })));
  }

  private async write(c: Context<ApiEnv>, status: 200 | 201, change: (body: unknown) => Promise<{ entry_id?: string; text?: string; deleted?: boolean }>) {
    Trace.line(import.meta.url, "MemoryRoutes.write", { path: c.req.path });
    try {
      const body = await c.req.json().catch(() => null);
      return c.json(await this.memory.write(c.get("principal").workspaceId, await change(body)), status);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 400);
    }
  }

  private static text(body: unknown): string {
    Trace.line(import.meta.url, "MemoryRoutes.text");
    const text = (body as { text?: unknown } | null)?.text;
    return typeof text === "string" ? text : "";
  }
}
