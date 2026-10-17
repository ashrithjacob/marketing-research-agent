import { Clock, type ProductCostBook, type ProductCosts, type ProductCostsInput } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** What one unit of a product costs its owner, per workspace. */
export class ProductCostTable implements ProductCostBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_product_costs (
    workspace_id     TEXT NOT NULL,
    product_id       TEXT NOT NULL,
    landed_unit_cost REAL NOT NULL,
    currency         TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    PRIMARY KEY (workspace_id, product_id)
);
`;

  constructor(private readonly db: SqlDatabase) {}

  async get(workspaceId: string, productId: string): Promise<ProductCosts | null> {
    Trace.line(import.meta.url, "ProductCostTable.get", { workspaceId, productId });
    const row = await this.db.get<ProductCosts>("SELECT product_id, landed_unit_cost, currency, updated_at FROM research_product_costs WHERE workspace_id = ? AND product_id = ?", [workspaceId, productId]);
    return row ? { ...row, landed_unit_cost: Number(row.landed_unit_cost) } : null;
  }

  async put(workspaceId: string, productId: string, costs: ProductCostsInput): Promise<ProductCosts> {
    Trace.line(import.meta.url, "ProductCostTable.put", { workspaceId, productId });
    const updated = Clock.nowIso();
    await this.db.run(
      "INSERT INTO research_product_costs (workspace_id, product_id, landed_unit_cost, currency, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(workspace_id, product_id) DO UPDATE SET landed_unit_cost = excluded.landed_unit_cost, currency = excluded.currency, updated_at = excluded.updated_at",
      [workspaceId, productId, costs.landed_unit_cost, costs.currency, updated],
    );
    return { product_id: productId, ...costs, updated_at: updated };
  }
}
