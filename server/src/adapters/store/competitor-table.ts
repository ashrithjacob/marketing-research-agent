import {
  CompetitorRelationship,
  Ids,
  type Competitor,
  type CompetitorPick,
  type CompetitorProfile,
  type CompetitorStore,
  type Product,
  type Relationship,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** A product's competitors: confirming a set marks those confirmed and every other one of the product's competitors proposed, so earlier research is kept but not re-run. */
export class CompetitorTable implements CompetitorStore {
  constructor(private readonly db: SqlDatabase) {}

  async confirm(product: Product, picks: readonly CompetitorPick[]): Promise<Competitor[]> {
    Trace.line(import.meta.url, "CompetitorTable.confirm", { productId: product.id, picks: picks.length });
    await this.db.transaction(async (tx) => {
      await tx.run("UPDATE competitors SET status = 'proposed', updated_at = now() WHERE product_id = ?", [product.id]);
      for (const pick of picks) {
        await tx.run(
          "INSERT INTO competitors (id, account_id, product_id, status, brand, product_name, url, domain) VALUES (?,?,?,?,?,?,?,?)" +
            " ON CONFLICT (product_id, url) DO UPDATE SET status = 'confirmed', brand = EXCLUDED.brand," +
            " product_name = EXCLUDED.product_name, updated_at = now()",
          [Ids.next(), product.account_id, product.id, "confirmed", pick.brand, pick.product_name, pick.url, CompetitorRelationship.domainOf(pick.url)],
        );
      }
    });
    return (await this.list(product.id)).filter((competitor) => competitor.status === "confirmed");
  }

  async list(productId: string): Promise<Competitor[]> {
    Trace.line(import.meta.url, "CompetitorTable.list", { productId });
    return this.db.all<Competitor>("SELECT * FROM competitors WHERE product_id = ? ORDER BY brand", [productId]);
  }

  async saveProfile(competitorId: string, profile: CompetitorProfile, relationship: Relationship): Promise<void> {
    Trace.line(import.meta.url, "CompetitorTable.saveProfile", { competitorId, relationship });
    await this.db.run(
      "UPDATE competitors SET platform = ?, form_factor = ?, has_key_active = ?, key_active = ?, price = ?, positioning = ?," +
        " sources = ?, relationship = ?, updated_at = now() WHERE id = ?",
      [
        profile.platform,
        profile.form_factor,
        profile.has_key_active,
        profile.key_active_as_listed,
        profile.price === null ? null : JSON.stringify(profile.price),
        profile.positioning,
        JSON.stringify(profile.sources),
        relationship,
        competitorId,
      ],
    );
  }
}
