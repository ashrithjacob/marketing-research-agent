import type { Context, Hono } from "hono";

import { RunError, type BrandShelf, type OwnerDesk } from "../agent/index.js";
import { Scope } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** `/brands`: the tiles of the first page, and a new brand's chat begun with a link or a name. */
export class BrandRoutes {
  constructor(
    private readonly shelf: BrandShelf,
    private readonly owner: OwnerDesk,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "BrandRoutes.register");
    api.get("/brands", async (c) => c.json({ data: await this.shelf.folders(c.get("principal").workspaceId, Scope.forViewer(c.get("principal"))) }));
    api.post("/brands", (c) => this.answer(c, async () => this.owner.open(c.get("principal").workspaceId, BrandRoutes.text(await c.req.json().catch(() => null)))));
  }

  private async answer(c: Context<ApiEnv>, work: () => Promise<unknown>) {
    Trace.line(import.meta.url, "BrandRoutes.answer", { path: c.req.path });
    try {
      return c.json(await work(), 201);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 400);
    }
  }

  private static text(body: unknown): string {
    Trace.line(import.meta.url, "BrandRoutes.text");
    const text = (body as { text?: unknown } | null)?.text;
    return typeof text === "string" ? text : "";
  }
}
