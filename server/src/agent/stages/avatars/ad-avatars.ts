import type { AdMarket, AvatarProfile, ReadAd } from "../../../domain/index.js";
import { type AdSegment } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AudienceSegmenter } from "../ads/audience-segmenter.js";

import { AdAvatarProfiler } from "./ad-avatar-profiler.js";

/** The avatars built from ads: one per audience segment stage 3 sorted the ads into, each written by an agent from its own ads; a same-buyer segment is also tied to one of the client's review avatars. A segment whose profile is refused is kept with its counts and no profile. */
export class AdAvatars {
  constructor(private readonly profiler = new AdAvatarProfiler()) {}

  async build(context: RunContext, ads: readonly ReadAd[], buyers: readonly AvatarProfile[]): Promise<{ segments: AdSegment[]; unprofiled: number }> {
    Trace.line(import.meta.url, "AdAvatars.build", { ads: ads.length });
    const groups = new Map<string, { market: AdMarket; ads: ReadAd[] }>();
    for (const ad of ads) {
      const market = ad.ring ? AudienceSegmenter.MARKET[ad.ring] : null;
      if (!ad.segment || !market) continue;
      const key = `${market}|${ad.segment}`;
      groups.set(key, { market, ads: [...(groups.get(key)?.ads ?? []), ad] });
    }
    const entries = [...groups.entries()].sort((a, b) => b[1].ads.length - a[1].ads.length);
    const results = await Promise.all(entries.map(([key, group], i) => this.profiler.profile(context, i + 1, key.split("|")[1]!, group.ads, group.market, buyers)));
    const segments = entries.map(([key, group], i) => ({
      key: `ad_${i + 1}`,
      market: group.market,
      name: key.split("|")[1]!,
      ads: group.ads,
      profile: results[i]!.status === "completed" ? results[i]!.value : null,
    }));
    return { segments, unprofiled: segments.filter((segment) => segment.profile === null).length };
  }
}
