import type { AdAngle, AngleHook, AngleRow, ReadAd } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { HookCutter } from "./hook-cutter.js";
import { Momentum } from "./momentum.js";

/** Counts each angle from its ads: how many, how many proven, which brands, how long they run, how recently they launched, how much risk the proven ones take, and the hooks of its strongest ads. */
export class AngleTally {
  static readonly HOOKS = 3;

  static rows(angles: readonly AdAngle[], ads: readonly ReadAd[], proven: ReadonlySet<string>, claims: readonly string[], asOf: string): AngleRow[] {
    Trace.line(import.meta.url, "AngleTally.rows", { angles: angles.length, ads: ads.length });
    const byId = new Map(ads.map((ad) => [ad.id, ad]));
    return angles.map((angle) => {
      const members = angle.ad_ids.map((id) => byId.get(id)).filter((ad): ad is ReadAd => ad !== undefined);
      const strong = members.filter((ad) => proven.has(ad.id));
      const days = members.map((ad) => ad.days_running).filter((d): d is number => d !== null).sort((a, b) => a - b);
      const dates = members.map((ad) => ad.first_seen).filter((d): d is string => !!d).sort();
      return {
        key: angle.key,
        name: angle.name,
        description: angle.description,
        ads: members.length,
        proven: strong.length,
        brands: [...new Set(members.map(AngleTally.brand))],
        median_days: days.length === 0 ? null : days[Math.floor((days.length - 1) / 2)]!,
        longest_days: days.at(-1) ?? null,
        duplicates: members.reduce((sum, ad) => sum + (ad.duplicates ?? 0), 0),
        earliest: dates[0] ?? null,
        ...Momentum.of(members, asOf),
        risk_share: strong.length === 0 ? null : strong.filter((ad) => (ad.reading?.risk_flags.length ?? 0) > 0).length / strong.length,
        fit: angle.fit,
        fit_claims: angle.fit_claim_indexes.map((index) => claims[index]).filter((claim): claim is string => claim !== undefined),
        fit_why: angle.fit_why,
        hooks: AngleTally.hooks(strong.length > 0 ? strong : members),
      };
    });
  }

  static brand(ad: Pick<ReadAd, "landing_domain" | "advertiser">): string {
    Trace.tick(import.meta.url, "AngleTally.brand");
    return (ad.landing_domain || ad.advertiser).replace(/^www\./, "").toLowerCase();
  }

  private static hooks(ads: readonly ReadAd[]): AngleHook[] {
    Trace.line(import.meta.url, "AngleTally.hooks", { ads: ads.length });
    return [...ads]
      .sort((a, b) => (b.days_running ?? 0) - (a.days_running ?? 0))
      .slice(0, AngleTally.HOOKS)
      .map((ad) => ({ ad_id: ad.id, advertiser: ad.advertiser, hook: HookCutter.cut(ad.copy), days_running: ad.days_running }));
  }
}
