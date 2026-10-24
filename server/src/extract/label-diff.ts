import type { LabelRow, ReadAd, StoredReading } from "../domain/index.js";
import { Trace } from "../trace/index.js";

type LabelValues = (reading: StoredReading) => readonly string[];

/** Each closed-list value's share among proven ads against its share among the rest of the read ads, over the ads that carry that label at all. A value on fewer than five ads is shown but not ranked: small counts swing the shares. */
export class LabelDiff {
  static readonly MIN_ADS = 5;
  static readonly LABELS: Readonly<Record<string, LabelValues>> = {
    claim_type: (r) => [r.claim_type],
    awareness: (r) => [r.awareness],
    proof: (r) => r.proof_kinds ?? [],
    offer: (r) => r.offer_kinds ?? [],
    emotion: (r) => (r.emotion_kind ? [r.emotion_kind] : []),
    landing: (r) => (r.landing_kind ? [r.landing_kind] : []),
    structure: (r) => (r.copy_structure ? [r.copy_structure] : []),
  };

  static rows(ads: readonly ReadAd[], proven: ReadonlySet<string>): LabelRow[] {
    Trace.line(import.meta.url, "LabelDiff.rows", { ads: ads.length, proven: proven.size });
    const read = ads.filter((ad) => ad.reading);
    const rows = Object.entries(LabelDiff.LABELS).flatMap(([label, values]) => LabelDiff.label(label, values, read, proven));
    return rows.sort((a, b) => Number(b.ranked) - Number(a.ranked) || b.difference - a.difference);
  }

  private static label(label: string, values: LabelValues, read: readonly ReadAd[], proven: ReadonlySet<string>): LabelRow[] {
    Trace.line(import.meta.url, "LabelDiff.label", { label });
    const carrying = read.map((ad) => ({ proven: proven.has(ad.id), values: new Set(values(ad.reading!)) })).filter((ad) => ad.values.size > 0);
    const provenTotal = carrying.filter((ad) => ad.proven).length;
    const restTotal = carrying.length - provenTotal;
    const seen = [...new Set(carrying.flatMap((ad) => [...ad.values]))];
    return seen.map((value) => {
      const withValue = carrying.filter((ad) => ad.values.has(value));
      const inProven = withValue.filter((ad) => ad.proven).length;
      const inRest = withValue.length - inProven;
      const proven_share = provenTotal === 0 ? 0 : inProven / provenTotal;
      const rest_share = restTotal === 0 ? 0 : inRest / restTotal;
      return { label, value, proven: inProven, rest: inRest, proven_share, rest_share, difference: proven_share - rest_share, ranked: withValue.length >= LabelDiff.MIN_ADS && provenTotal > 0 && restTotal > 0 };
    });
  }
}
