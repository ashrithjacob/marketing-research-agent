import type { AngleTrend, StoredAd } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** How recently a set of ads was launched, counted from each ad's first-seen date against the run's date: launches in the last 30 and 60 days, and whether the set is rising (most of its dated ads are recent), fading (none are) or steady. */
export class Momentum {
  static readonly DAY_MS = 86_400_000;
  static readonly MIN_DATED = 3;

  static of(ads: readonly Pick<StoredAd, "first_seen">[], asOf: string): { launched_30d: number; launched_60d: number; trend: AngleTrend } {
    Trace.line(import.meta.url, "Momentum.of", { ads: ads.length, asOf });
    const ages = ads.filter((ad) => ad.first_seen).map((ad) => (Date.parse(asOf) - Date.parse(ad.first_seen!)) / Momentum.DAY_MS);
    const launched_30d = ages.filter((age) => age <= 30).length;
    const launched_60d = ages.filter((age) => age <= 60).length;
    const trend: AngleTrend = ages.length < Momentum.MIN_DATED ? "steady" : launched_60d * 2 > ages.length ? "rising" : launched_60d === 0 ? "fading" : "steady";
    return { launched_30d, launched_60d, trend };
  }
}
