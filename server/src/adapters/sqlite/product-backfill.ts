import type Database from "better-sqlite3";

import { Briefs } from "../../domain/index.js";

import type { PacketRowTable } from "./packet-row-table.js";
import type { ProductTable } from "./product-table.js";
import { Rows } from "./rows.js";
import { Trace } from "../../trace/index.js";

/** Gives every run from before products were stored its product, its packet rows and its review links. */
export class ProductBackfill {
  constructor(
    private readonly db: Database.Database,
    private readonly products: ProductTable,
    private readonly packetRows: PacketRowTable,
  ) {}

  apply(): number {
    Trace.line(import.meta.url, "ProductBackfill.apply");
    const legacy = this.db
      .prepare("SELECT id, brief, packet FROM research_runs WHERE product_id = '' ORDER BY created_at")
      .all() as Array<{ id: string; brief: string; packet: string }>;
    const setProduct = this.db.prepare("UPDATE research_runs SET product_id = ? WHERE id = ?");
    const linkReviews = this.db.prepare(
      "UPDATE research_run_reviews SET product_id = ? WHERE run_id = ?",
    );
    this.db.transaction(() => {
      for (const run of legacy) {
        const brief = Rows.json(run.brief, {}) as Record<string, unknown>;
        const productId = this.products.ensure(Briefs.key(brief), Briefs.label(brief));
        setProduct.run(productId, run.id);
        linkReviews.run(productId, run.id);
        this.packetRows.replace(run.id, productId, Rows.json(run.packet, null));
      }
    })();
    return legacy.length;
  }
}
