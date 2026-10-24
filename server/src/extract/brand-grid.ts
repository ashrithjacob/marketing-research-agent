import type { AdAngle, BrandRow, ReadAd } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { AngleTally } from "./angle-tally.js";
import { Momentum } from "./momentum.js";

/** Who runs which angle: one row per confirmed competitor and per other brand with at least three kept ads, a cell per angle it uses. Counts are of kept ads, at most the scout's per-brand cap. */
export class BrandGrid {
  static readonly MIN_ADS = 3;

  static rows(angles: readonly AdAngle[], ads: readonly ReadAd[], proven: ReadonlySet<string>, asOf: string): BrandRow[] {
    Trace.line(import.meta.url, "BrandGrid.rows", { angles: angles.length, ads: ads.length });
    const angleOf = new Map(angles.flatMap((angle) => angle.ad_ids.map((id) => [id, angle.key] as const)));
    const byBrand = new Map<string, ReadAd[]>();
    for (const ad of ads) byBrand.set(AngleTally.brand(ad), [...(byBrand.get(AngleTally.brand(ad)) ?? []), ad]);
    const rows = [...byBrand.entries()]
      .filter(([, own]) => own.some((ad) => ad.competitor_id !== null) || own.length >= BrandGrid.MIN_ADS)
      .map(([domain, own]) => {
        const cells: BrandRow["cells"] = {};
        for (const ad of own) {
          const key = angleOf.get(ad.id);
          if (!key) continue;
          const cell = (cells[key] ??= { ads: 0, proven: 0 });
          cell.ads += 1;
          if (proven.has(ad.id)) cell.proven += 1;
        }
        return {
          domain,
          advertiser: own[0]!.advertiser,
          competitor: own.some((ad) => ad.competitor_id !== null),
          ads: own.length,
          proven: own.filter((ad) => proven.has(ad.id)).length,
          launched_60d: Momentum.of(own, asOf).launched_60d,
          cells,
        };
      });
    return rows.sort((a, b) => Number(b.competitor) - Number(a.competitor) || b.ads - a.ads);
  }
}
