import type { AdAngle, AdFinding, AdsAnalysis, ReadAd } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { AngleTally } from "./angle-tally.js";
import { BrandGrid } from "./brand-grid.js";
import { LabelDiff } from "./label-diff.js";
import { ProvenRule } from "./proven-rule.js";

/** Everything the long-form ads page counts for one run, from its kept ads, their angles and the client's claims, as of the run's date. */
export class AdsAnalyzer {
  static analyze(ads: readonly ReadAd[], angles: readonly AdAngle[], findings: readonly AdFinding[], claims: readonly string[], asOf: string): AdsAnalysis {
    Trace.line(import.meta.url, "AdsAnalyzer.analyze", { ads: ads.length, angles: angles.length, findings: findings.length });
    const proven = new Set(ads.filter(ProvenRule.isProven).map((ad) => ad.id));
    return {
      as_of: asOf,
      read: ads.filter((ad) => ad.reading).length,
      proven: proven.size,
      proven_ids: [...proven],
      angle_of: Object.fromEntries(angles.flatMap((angle) => angle.ad_ids.map((id) => [id, angle.key]))),
      angles: AngleTally.rows(angles, ads, proven, claims, asOf),
      labels: LabelDiff.rows(ads, proven),
      brands: BrandGrid.rows(angles, ads, proven, asOf),
      findings: [...findings],
    };
  }
}
