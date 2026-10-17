import { Ids, type Product, type ProductBrief, type ProductStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

export class ProductTable implements ProductStore {
  constructor(private readonly db: SqlDatabase) {}

  async upsert(accountId: string, url: string, name: string): Promise<Product> {
    Trace.line(import.meta.url, "ProductTable.upsert", { accountId, url });
    const row = await this.db.get<{ id: string }>(
      "INSERT INTO products (id, account_id, url, name) VALUES (?,?,?,?)" +
        " ON CONFLICT (account_id, url) DO UPDATE SET updated_at = now() RETURNING id",
      [Ids.next(), accountId, url, name],
    );
    return (await this.get(row!.id))!;
  }

  async get(productId: string): Promise<Product | null> {
    Trace.line(import.meta.url, "ProductTable.get", { productId });
    return this.db.get<Product>("SELECT * FROM products WHERE id = ?", [productId]);
  }

  async saveBrief(productId: string, brief: ProductBrief): Promise<Product> {
    Trace.line(import.meta.url, "ProductTable.saveBrief", { productId });
    await this.db.run(
      "UPDATE products SET brand = ?, name = ?, category = ?, form_factor = ?, key_active = ?, price = ?, offer = ?," +
        " ingredients = ?, claims_on_page = ?, updated_at = now() WHERE id = ?",
      [
        brief.brand,
        brief.name,
        brief.category,
        brief.form_factor,
        brief.key_active,
        brief.price === null ? null : JSON.stringify(brief.price),
        JSON.stringify(brief.offer),
        JSON.stringify(brief.ingredients),
        JSON.stringify(brief.claims_on_page),
        productId,
      ],
    );
    return (await this.get(productId))!;
  }
}
