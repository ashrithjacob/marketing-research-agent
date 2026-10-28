import { GapThemesSchema, type AvatarMemory, type AvatarProfile, type GapThemes, type ReadAd, type StoredReview } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { GAP_FINDER_SYSTEM } from "../../prompt/text/avatars.js";

import { MemoryView } from "./memory-view.js";

/** Finds what one review avatar's buyers say that the ads placed on it do not; code checks every theme cites only reviews it was given from that avatar. */
export class GapFinder {
  static readonly MAX_TURNS = 3;
  static readonly SAMPLE = 30;

  async find(context: RunContext, memory: AvatarMemory, avatar: AvatarProfile, reviews: ReadonlyMap<string, StoredReview>, ads: readonly ReadAd[]): Promise<AgentResult<GapThemes>> {
    Trace.line(import.meta.url, "GapFinder.find", { avatar: avatar.key });
    const family = memory.avatars.filter((member) => member.key === avatar.key || member.parent === avatar.key);
    const sample = GapFinder.sample(family, reviews);
    const ids = sample.map((review) => review.id);
    const adIds = new Set(family.flatMap((member) => member.ad_ids));
    const placed = ads.filter((ad) => adIds.has(ad.id));
    return context.agent({
      agentId: `gap_finder:${avatar.key}`,
      system: GAP_FINDER_SYSTEM,
      instructions: [
        MemoryView.memory({ ...memory, avatars: family }),
        `${sample.length} of its reviews:`,
        MemoryView.reviews(sample),
        placed.length > 0 ? `The ${placed.length} ads placed on it:\n${MemoryView.ads(placed)}` : "No ad is placed on this avatar.",
      ].join("\n\n"),
      tools: [],
      maxTurns: GapFinder.MAX_TURNS,
      reasoning: "low",
      submission: { schema: GapThemesSchema, describe: "Hand back what the reviews say that the ads do not.", check: (gaps) => gaps.themes.flatMap((theme) => theme.review_ids.filter((id) => !ids.includes(id)).map((id) => `review ${id} was not given for this avatar; copy ids exactly`)) },
    });
  }

  /** The avatar's quotes first, then its other reviews spread across star ratings, up to SAMPLE. */
  static sample(family: readonly AvatarProfile[], reviews: ReadonlyMap<string, StoredReview>): StoredReview[] {
    Trace.line(import.meta.url, "GapFinder.sample", { members: family.length });
    const quoted = family.flatMap((member) => member.quote_ids);
    const rest = family.flatMap((member) => member.review_ids).filter((id) => !quoted.includes(id));
    const byStars = [...new Set(rest)].map((id) => reviews.get(id)).filter((r): r is StoredReview => r !== undefined).sort((a, b) => a.rating - b.rating);
    const spread = byStars.filter((_, i) => i % Math.max(1, Math.floor(byStars.length / GapFinder.SAMPLE)) === 0);
    const picked = [...new Set(quoted)].map((id) => reviews.get(id)).filter((r): r is StoredReview => r !== undefined);
    return [...picked, ...spread].slice(0, GapFinder.SAMPLE);
  }
}
