import { Briefs } from "../../domain/index.js";

import type { PacketRowTable } from "./packet-row-table.js";
import type { ProductTable } from "./product-table.js";
import { Rows } from "./rows.js";
import type { SqlDatabase } from "./sql-database.js";
import { Trace } from "../../trace/index.js";

/** Gives every run from before products were stored its product, its packet rows and its review links; a run is marked done last, so an interrupted backfill resumes. */
export class ProductBackfill {
  constructor(
    private readonly db: SqlDatabase,
    private readonly products: ProductTable,
    private readonly packetRows: PacketRowTable,
  ) {}

  async apply(): Promise<number> {
    Trace.line(import.meta.url, "ProductBackfill.apply");
    const legacy = await this.db.all<{ id: string; brief: string; packet: string }>(
      "SELECT id, brief, packet FROM research_runs WHERE product_id = '' ORDER BY created_at",
    );
    for (const run of legacy) {
      const brief = Rows.json(run.brief, {}) as Record<string, unknown>;
      const productId = await this.products.ensure(Briefs.key(brief), Briefs.label(brief));
      await this.packetRows.replace(run.id, productId, Rows.json(run.packet, null));
      await this.db.run("UPDATE research_run_reviews SET product_id = ? WHERE run_id = ?", [productId, run.id]);
      await this.db.run("UPDATE research_runs SET product_id = ? WHERE id = ?", [productId, run.id]);
    }
    return legacy.length;
  }
}
