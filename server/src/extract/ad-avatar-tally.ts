import type { AdAvatarProfile, AdMarket, AvatarRecord, ReadAd } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { AvatarFloor } from "./avatar-floor.js";
import { AvatarTally } from "./avatar-tally.js";

export interface AdSegment {
  key: string;
  market: AdMarket;
  name: string;
  ads: readonly ReadAd[];
  profile: AdAvatarProfile | null;
}

/** Counts each ad avatar, one per stage 3 audience segment: its share of the segmented ads, its win rate, how its ads open; one under the floor is emerging. */
export class AdAvatarTally {
  static records(segments: readonly AdSegment[]): AvatarRecord[] {
    Trace.line(import.meta.url, "AdAvatarTally.records", { segments: segments.length });
    const total = segments.reduce((sum, segment) => sum + segment.ads.length, 0);
    return segments.map((segment) => {
      const ids = segment.ads.map((ad) => ad.id);
      const p = segment.profile;
      return {
        parent_key: null,
        review_ids: [],
        quote_ids: [],
        ad_ids: ids,
        gap_review_ids: [],
        avatar: {
          key: segment.key,
          source: "ads" as const,
          name: segment.name,
          description: p?.description ?? "",
          review_count: 0,
          ad_count: ids.length,
          demand_share: 0,
          supply_share: total === 0 ? null : ids.length / total,
          win_rate: ids.length === 0 ? null : segment.ads.filter((ad) => ad.bucket === "winning").length / ids.length,
          awareness: null,
          confidence: null,
          standing: AvatarFloor.emerging(ids.length, true) ? "emerging" : "avatar",
          profile: {
            pains: p?.pains ?? [],
            desires: p?.desires ?? [],
            triggers: p?.triggers ?? [],
            prior_solutions: [],
            objections: p?.objections ?? [],
            outcomes: [],
            angles: p?.angles ?? [],
            best_competitor_angle: null,
            skepticism: null,
            skepticism_review_ids: [],
            awareness_by_channel: AvatarTally.awareness(ids, [], segment.ads, new Map()),
            quote_ad_ids: p?.quote_ad_ids ?? [],
            market: segment.market,
            ...(p?.same_buyer ? { same_buyer: p.same_buyer } : {}),
          },
        },
      };
    });
  }
}
