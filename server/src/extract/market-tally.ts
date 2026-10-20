import { AdRings, type AwarenessChannel, type AwarenessLevel, type ChannelAwareness, type ClaimCensus, type EvidenceItem, type EvidenceKind, type MarketAssessment, type MarketRead, type ReadAd } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Counts what the market reader cited: each claim's brands, dates and runs, and each channel's awareness shares. The reader labels; this does every number. */
export class MarketTally {
  static readonly CHANNEL: Readonly<Partial<Record<EvidenceKind, AwarenessChannel>>> = {
    landing_page: "landing_pages",
    google_query: "google_search",
    amazon_query: "amazon_search",
    amazon_listing: "amazon_listings",
    reddit: "reddit",
    review: "reviews",
  };
  static readonly EVIDENCE_CHARS = 400;

  static assessment(runId: string, read: MarketRead, items: ReadonlyMap<string, EvidenceItem>, stageAds: readonly ReadAd[]): MarketAssessment {
    Trace.line(import.meta.url, "MarketTally.assessment", { runId, groups: read.claim_groups.length, labels: read.labels.length });
    const labelled = new Map(read.labels.map((label) => [label.id, label.awareness]));
    const cited = new Set([...read.claim_groups.flatMap((group) => group.ad_ids), ...read.sophistication.snapshot_ids, ...labelled.keys()]);
    return {
      run_id: runId,
      sophistication_stage: read.sophistication.stage,
      confidence: read.sophistication.confidence,
      why: read.sophistication.why,
      claims: MarketTally.census(read, items),
      awareness: [MarketTally.metaAds(stageAds), ...MarketTally.channels(labelled, items)].filter((channel) => channel.items > 0),
      evidence: [...cited].map((id) => items.get(id)).filter((item): item is EvidenceItem => item !== undefined).map((item) => ({ ...item, text: item.text.slice(0, MarketTally.EVIDENCE_CHARS), awareness: labelled.get(item.id) ?? null })),
      snapshot_ids: read.sophistication.snapshot_ids,
    };
  }

  static census(read: MarketRead, items: ReadonlyMap<string, EvidenceItem>): ClaimCensus[] {
    Trace.line(import.meta.url, "MarketTally.census", { groups: read.claim_groups.length });
    return read.claim_groups.map((group) => {
      const ads = group.ad_ids.map((id) => items.get(id)).filter((item): item is EvidenceItem => item !== undefined);
      const dates = ads.map((ad) => ad.date).filter((date): date is string => Boolean(date)).sort();
      const days = ads.map((ad) => ad.days_running).filter((value): value is number => value !== null);
      return {
        key: group.key,
        claim: group.claim,
        claim_type: group.claim_type,
        ads: ads.length,
        brands: [...new Set(ads.map((ad) => ad.brand).filter((brand): brand is string => Boolean(brand)))].sort(),
        first_seen: dates[0] ?? null,
        longest_days: days.length > 0 ? Math.max(...days) : null,
        active: ads.filter((ad) => ad.active === true).length,
      };
    });
  }

  static metaAds(ads: readonly ReadAd[]): ChannelAwareness {
    Trace.line(import.meta.url, "MarketTally.metaAds", { ads: ads.length });
    const levels = ads.filter((ad) => AdRings.isSupply(ad) && ad.reading?.awareness).map((ad) => ({ level: ad.reading!.awareness as AwarenessLevel, weight: 1 }));
    return MarketTally.shares("meta_ads", levels, false);
  }

  static channels(labelled: ReadonlyMap<string, AwarenessLevel>, items: ReadonlyMap<string, EvidenceItem>): ChannelAwareness[] {
    Trace.line(import.meta.url, "MarketTally.channels", { labels: labelled.size });
    const byChannel = new Map<AwarenessChannel, Array<{ level: AwarenessLevel; volume: number | null }>>();
    for (const [id, level] of labelled) {
      const channel = MarketTally.CHANNEL[items.get(id)?.kind ?? "stage_ad"];
      if (channel) byChannel.set(channel, [...(byChannel.get(channel) ?? []), { level, volume: items.get(id)?.volume ?? null }]);
    }
    return [...byChannel.entries()].map(([channel, entries]) => {
      const weighted = entries.every((entry) => entry.volume !== null && entry.volume > 0);
      return MarketTally.shares(channel, entries.map((entry) => ({ level: entry.level, weight: weighted ? entry.volume! : 1 })), weighted);
    });
  }

  private static shares(channel: AwarenessChannel, entries: ReadonlyArray<{ level: AwarenessLevel; weight: number }>, weighted: boolean): ChannelAwareness {
    Trace.line(import.meta.url, "MarketTally.shares", { channel, entries: entries.length });
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    const shares: Partial<Record<AwarenessLevel, number>> = {};
    for (const entry of entries) shares[entry.level] = (shares[entry.level] ?? 0) + entry.weight / total;
    for (const level of Object.keys(shares) as AwarenessLevel[]) shares[level] = Math.round(shares[level]! * 1000) / 1000;
    return { channel, items: entries.length, weighted_by_volume: weighted, shares };
  }
}
