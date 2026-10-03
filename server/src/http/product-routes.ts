import type { Context, Hono } from "hono";

import { ProductFolders, Runs, Scope, type ResearchRun, type ResearchStore } from "../domain/index.js";
import type { ApiEnv } from "./api-env.js";
import { Trace } from "../trace/index.js";

/** Products, each with every run of it and every row those runs found, inside the caller's scope. */
export class ProductRoutes {
  constructor(private readonly store: ResearchStore) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "ProductRoutes.register");
    api.get("/products", async (c) => {
      const scope = ProductRoutes.scope(c);
      return c.json({ data: ProductFolders.summaries(await this.store.products.list(scope), await this.store.products.runHeads(scope)) });
    });
    api.get("/products/:productId", async (c) => {
      const summary = await this.summary(c.req.param("productId"), ProductRoutes.scope(c));
      return summary ? c.json(summary) : c.json({ detail: "no such product" }, 404);
    });
    api.get("/products/:productId/runs", async (c) => {
      const ids = ProductFolders.runIds(await this.store.products.runHeads(ProductRoutes.scope(c)), c.req.param("productId"));
      const runs = (await Promise.all(ids.map((id) => this.store.getRun(id)))).filter((run): run is ResearchRun => run !== null);
      return c.json({ data: runs.map(Runs.summary) });
    });
    api.get("/products/:productId/rows", async (c) => {
      return c.json(await this.store.products.packetRows(c.req.param("productId"), ProductRoutes.scope(c)));
    });
  }

  private async summary(productId: string, scope: Scope) {
    Trace.line(import.meta.url, "ProductRoutes.summary", { productId, scope });
    const product = await this.store.products.get(productId, scope);
    if (!product) return null;
    return ProductFolders.summaries([product], await this.store.products.runHeads(scope))[0] ?? null;
  }

  private static scope(c: Context<ApiEnv>): Scope {
    Trace.line(import.meta.url, "ProductRoutes.scope");
    return Scope.forViewer(c.get("principal"));
  }
}
