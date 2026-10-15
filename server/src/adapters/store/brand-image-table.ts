import { Clock, type BrandImage, type BrandImageBook, type BrandImageKind } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** Each brand's graphic, read once off its homepage; shared by every workspace, as products are. */
export class BrandImageTable implements BrandImageBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_brand_images (
    key        TEXT PRIMARY KEY,
    image_url  TEXT NOT NULL,
    kind       TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);
`;

  constructor(private readonly db: SqlDatabase) {}

  async list(keys: readonly string[]): Promise<BrandImage[]> {
    Trace.line(import.meta.url, "BrandImageTable.list", { keys: keys.length });
    if (keys.length === 0) return [];
    return this.db.all<BrandImage>(`SELECT key, image_url, kind, fetched_at FROM research_brand_images WHERE key IN (${keys.map(() => "?").join(",")})`, [...keys]);
  }

  async put(key: string, image: { image_url: string; kind: BrandImageKind }): Promise<void> {
    Trace.line(import.meta.url, "BrandImageTable.put", { key, kind: image.kind });
    await this.db.run(
      "INSERT INTO research_brand_images (key, image_url, kind, fetched_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET image_url = excluded.image_url, kind = excluded.kind, fetched_at = excluded.fetched_at",
      [key, image.image_url, image.kind, Clock.nowIso()],
    );
  }
}
