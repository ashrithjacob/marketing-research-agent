import type { Context, Hono } from "hono";

import { RunError, type WatchDesk } from "../agent/index.js";
import type { ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** What the watchers look at: watched competitors, connected Meta ad accounts, and the ads a draft became with their results. */
export class WatchRoutes {
  constructor(
    private readonly desk: WatchDesk,
    private readonly store: ResearchStore,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "WatchRoutes.register");
    api.get("/watch/brands", async (c) => c.json({ data: await this.store.watch.brands(WatchRoutes.workspace(c)) }));
    api.post("/watch/brands", (c) => this.answer(c, 201, (body) => this.desk.addBrand(WatchRoutes.workspace(c), WatchRoutes.field(body, "term"), WatchRoutes.field(body, "search_in") || "brand")));
    api.delete("/watch/brands/:id", (c) => this.answer(c, 200, async () => ({ ok: (await this.store.watch.removeBrand(WatchRoutes.workspace(c), c.req.param("id")), true) })));
    api.get("/ad-accounts", async (c) => c.json({ data: await this.store.ads.accounts(WatchRoutes.workspace(c)) }));
    api.post("/ad-accounts", (c) => this.answer(c, 201, (body) => this.desk.connect(WatchRoutes.workspace(c), WatchRoutes.field(body, "account_id"))));
    api.delete("/ad-accounts/:id", (c) => this.answer(c, 200, async () => ({ ok: (await this.store.ads.disconnect(WatchRoutes.workspace(c), c.req.param("id")), true) })));
    api.get("/drafts/:draftId/ads", (c) => this.answer(c, 200, async () => ({ data: await this.desk.draftAds(WatchRoutes.workspace(c), c.req.param("draftId")) })));
    api.post("/drafts/:draftId/ads", (c) => this.answer(c, 201, async (body) => ({ ok: (await this.desk.link(WatchRoutes.workspace(c), c.req.param("draftId"), WatchRoutes.field(body, "ad_id")), true) })));
  }

  private async answer(c: Context<ApiEnv>, status: 200 | 201, work: (body: unknown) => Promise<unknown>) {
    Trace.line(import.meta.url, "WatchRoutes.answer", { path: c.req.path });
    try {
      const body = c.req.method === "POST" ? await c.req.json().catch(() => null) : null;
      return c.json(await work(body), status);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 400);
    }
  }

  private static workspace(c: Context<ApiEnv>): string {
    Trace.line(import.meta.url, "WatchRoutes.workspace");
    return c.get("principal").workspaceId;
  }

  private static field(body: unknown, key: string): string {
    Trace.line(import.meta.url, "WatchRoutes.field", { key });
    const value = (body as Record<string, unknown> | null)?.[key];
    return typeof value === "string" ? value : "";
  }
}
