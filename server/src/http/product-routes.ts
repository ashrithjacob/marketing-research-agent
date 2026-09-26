import type { Hono } from "hono";

import { ProductFolders, Runs, type ResearchRun, type ResearchStore } from "../domain/index.js";

/** Products, each with every run of it and every row those runs found. */
export class ProductRoutes {
  constructor(private readonly store: ResearchStore) {}

  register(api: Hono): void {
    api.get("/products", (c) =>
      c.json({ data: ProductFolders.summaries(this.store.products.list(), this.store.products.runHeads()) }),
    );
    api.get("/products/:productId", (c) => {
      const summary = this.summary(c.req.param("productId"));
      return summary ? c.json(summary) : c.json({ detail: "no such product" }, 404);
    });
    api.get("/products/:productId/runs", (c) => {
      const runs = ProductFolders.runIds(this.store.products.runHeads(), c.req.param("productId"))
        .map((id) => this.store.getRun(id))
        .filter((run): run is ResearchRun => run !== null);
      return c.json({ data: runs.map(Runs.summary) });
    });
    api.get("/products/:productId/rows", (c) => {
      const productId = c.req.param("productId");
      if (!this.store.products.get(productId)) return c.json({ detail: "no such product" }, 404);
      return c.json(this.store.products.packetRows(productId));
    });
  }

  private summary(productId: string) {
    const product = this.store.products.get(productId);
    if (!product) return null;
    return ProductFolders.summaries([product], this.store.products.runHeads())[0] ?? null;
  }
}
