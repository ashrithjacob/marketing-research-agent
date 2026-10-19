import type { BrandVisual, BrandVisualCache } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

export class VisualTable implements BrandVisualCache {
  constructor(private readonly db: SqlDatabase) {}

  async get(urls: readonly string[]): Promise<Map<string, BrandVisual>> {
    Trace.line(import.meta.url, "VisualTable.get", { count: urls.length });
    if (urls.length === 0) return new Map();
    const rows = await this.db.all<{ url: string; image_url: string | null; logo_url: string | null }>(
      `SELECT url, image_url, logo_url FROM brand_visuals WHERE url IN (${urls.map(() => "?").join(",")})`,
      [...urls],
    );
    return new Map(rows.map((row) => [row.url, { image_url: row.image_url, logo_url: row.logo_url }]));
  }

  async put(url: string, visual: BrandVisual): Promise<void> {
    Trace.line(import.meta.url, "VisualTable.put", { url });
    await this.db.run(
      "INSERT INTO brand_visuals (url, image_url, logo_url) VALUES (?,?,?) ON CONFLICT (url) DO UPDATE SET image_url = EXCLUDED.image_url, logo_url = EXCLUDED.logo_url, fetched_at = now()",
      [url, visual.image_url, visual.logo_url],
    );
  }
}
