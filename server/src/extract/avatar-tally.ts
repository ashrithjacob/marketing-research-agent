import type { AvatarMemory, AvatarProfile, AvatarRecord, AvatarVerdicts, ReadAd } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Counts what each avatar rests on, with no thresholds: a top-level avatar counts its sub-avatars' reviews and ads too; shares are over everything assigned to some avatar; win rate is over the avatar's own ads. */
export class AvatarTally {
  static records(memory: AvatarMemory, verdicts: AvatarVerdicts | null, ads: readonly ReadAd[]): AvatarRecord[] {
    Trace.line(import.meta.url, "AvatarTally.records", { avatars: memory.avatars.length, ads: ads.length });
    const reviewTotal = memory.avatars.reduce((sum, avatar) => sum + avatar.review_ids.length, 0);
    const adTotal = memory.avatars.reduce((sum, avatar) => sum + avatar.ad_ids.length, 0);
    const winning = new Set(ads.filter((ad) => ad.bucket === "winning").map((ad) => ad.id));
    const judged = new Map((verdicts?.verdicts ?? []).map((verdict) => [verdict.key, verdict]));
    return memory.avatars.map((avatar) => {
      const family = [avatar, ...memory.avatars.filter((child) => child.parent === avatar.key)];
      const reviewIds = [...new Set(family.flatMap((member) => member.review_ids))];
      const adIds = [...new Set(family.flatMap((member) => member.ad_ids))];
      const verdict = judged.get(avatar.key);
      return {
        parent_key: avatar.parent,
        review_ids: avatar.review_ids,
        quote_ids: avatar.quote_ids,
        ad_ids: avatar.ad_ids,
        avatar: {
          key: avatar.key,
          name: avatar.name,
          description: avatar.description,
          review_count: reviewIds.length,
          ad_count: adIds.length,
          demand_share: reviewTotal === 0 ? 0 : reviewIds.length / reviewTotal,
          supply_share: adTotal === 0 ? null : adIds.length / adTotal,
          win_rate: adIds.length === 0 ? null : adIds.filter((id) => winning.has(id)).length / adIds.length,
          awareness: verdict?.awareness ?? null,
          confidence: verdict?.confidence ?? null,
          standing: verdict?.standing ?? "emerging",
          profile: { ...AvatarTally.profile(avatar), best_competitor_angle: verdict?.best_competitor_angle ?? null },
        },
      };
    });
  }

  private static profile(avatar: AvatarProfile): Omit<AvatarRecord["avatar"]["profile"], "best_competitor_angle"> {
    Trace.tick(import.meta.url, "AvatarTally.profile");
    const { pains, desires, triggers, prior_solutions, objections, outcomes, angles } = avatar;
    return { pains, desires, triggers, prior_solutions, objections, outcomes, angles };
  }
}
