import type { Context, Hono } from "hono";

import { RunStatuses, Scope, productCostsInputSchema, productTruthPacketSchema, type Margin, type ProductCosts, type ResearchStore } from "../domain/index.js";
import { ProductEconomics } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** The owner's landed unit cost for a product, typed on the Margin card, and the gross margin it gives at each price the latest product truth found: arithmetic, no model. */
export class ProductCostRoutes {
  constructor(private readonly store: ResearchStore) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "ProductCostRoutes.register");
    api.get("/products/:productId/costs", async (c) => {
      const productId = c.req.param("productId");
      if (!(await this.store.products.get(productId, Scope.forViewer(c.get("principal"))))) return c.json({ detail: "no such product" }, 404);
      return c.json(await this.view(c, productId, await this.store.productCosts.get(c.get("principal").workspaceId, productId)));
    });
    api.post("/products/:productId/costs", async (c) => {
      const productId = c.req.param("productId");
      if (!(await this.store.products.get(productId, Scope.forViewer(c.get("principal"))))) return c.json({ detail: "no such product" }, 404);
      const parsed = productCostsInputSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ detail: "landed_unit_cost must be a positive number and currency a three-letter code" }, 400);
      return c.json(await this.view(c, productId, await this.store.productCosts.put(c.get("principal").workspaceId, productId, parsed.data)));
    });
  }

  private async view(c: Context<ApiEnv>, productId: string, costs: ProductCosts | null): Promise<{ costs: ProductCosts | null; margins: Margin[] }> {
    Trace.line(import.meta.url, "ProductCostRoutes.view", { productId, entered: costs !== null });
    if (!costs) return { costs, margins: [] };
    const operator = { landed_unit_cost: costs.landed_unit_cost, currency: costs.currency, moq: null, lead_time_days: null };
    const prices = await this.latestPrices(c, productId);
    return { costs, margins: prices.map((price) => ProductEconomics.margin(price, operator)) };
  }

  /** The prices the newest delivered product-truth run of this product kept. */
  private async latestPrices(c: Context<ApiEnv>, productId: string) {
    Trace.line(import.meta.url, "ProductCostRoutes.latestPrices", { productId });
    const heads = await this.store.products.runHeads(Scope.forViewer(c.get("principal")));
    const truth = heads
      .filter((head) => head.product_id === productId && head.stage === 2 && RunStatuses.delivered(head.status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const packet = productTruthPacketSchema.safeParse(truth ? (await this.store.getRun(truth.id))?.packet : null);
    return packet.success ? packet.data.prices : [];
  }
}
