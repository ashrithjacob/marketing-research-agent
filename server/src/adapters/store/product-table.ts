import { Ids, type BrandVisual, type Product, type ProductBrief, type ProductStore, type ShopTraction } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

export class ProductTable implements ProductStore {
  constructor(private readonly db: SqlDatabase) {}

  async upsert(accountId: string, url: string, name: string, brand: string): Promise<Product> {
    Trace.line(import.meta.url, "ProductTable.upsert", { accountId, url });
    const row = await this.db.get<{ id: string }>(
      "INSERT INTO products (id, account_id, url, name, brand) VALUES (?,?,?,?,?)" +
        " ON CONFLICT (account_id, url) DO UPDATE SET brand = CASE WHEN products.brand = '' THEN EXCLUDED.brand ELSE products.brand END," +
        " updated_at = now() RETURNING id",
      [Ids.next(), accountId, url, name, brand],
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
      "UPDATE products SET brand = ?, name = ?, category = ?, form_factor = ?, key_active = ?, price = ?, offer = ?, price_points = ?," +
        " subscription_terms = ?, pack = ?, ingredients = ?, claims_on_page = ?, coa_url = ?, miscellaneous = ?, updated_at = now() WHERE id = ?",
      [
        brief.brand,
        brief.name,
        brief.category,
        brief.form_factor,
        brief.key_active,
        brief.price === null ? null : JSON.stringify(brief.price),
        JSON.stringify(brief.offer),
        JSON.stringify(brief.price_points),
        brief.subscription_terms === null ? null : JSON.stringify(brief.subscription_terms),
        brief.pack === null ? null : JSON.stringify(brief.pack),
        JSON.stringify(brief.ingredients),
        JSON.stringify(brief.claims_on_page),
        brief.coa_url,
        JSON.stringify(brief.miscellaneous),
        productId,
      ],
    );
    return (await this.get(productId))!;
  }

  async saveVisual(productId: string, visual: BrandVisual): Promise<void> {
    Trace.line(import.meta.url, "ProductTable.saveVisual", { productId, visual });
    await this.db.run("UPDATE products SET image_url = COALESCE(?, image_url), logo_url = COALESCE(?, logo_url), updated_at = now() WHERE id = ?", [visual.image_url, visual.logo_url, productId]);
  }

  async saveTraction(productId: string, traction: ShopTraction): Promise<void> {
    Trace.line(import.meta.url, "ProductTable.saveTraction", { productId, shop: traction.shop_id });
    await this.db.run("UPDATE products SET traction = ?, updated_at = now() WHERE id = ?", [JSON.stringify(traction), productId]);
  }
}
