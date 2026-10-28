import { AdAvatarProfileSchema, SameBuyerAdAvatarProfileSchema, type AdAvatarProfile, type AdMarket, type AvatarProfile, type ReadAd } from "../../../domain/index.js";
import { AdScripts } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AD_AVATAR_SYSTEM, SAME_BUYER_INSTRUCTION } from "../../prompt/text/avatars.js";
import { ToolReply } from "../../tools/tool-reply.js";

/** Writes the avatar one stage 3 audience segment's ads are aimed at, from what the reader recorded of each distinct copy; for a same-buyer segment, also which of the client's review avatars its readers are and what carries over. Code checks it cites only that segment's ads and only a listed avatar. */
export class AdAvatarProfiler {
  static readonly MAX_TURNS = 3;
  static readonly HOOK_CHARS = 200;

  async profile(context: RunContext, number: number, segment: string, ads: readonly ReadAd[], market: AdMarket, buyers: readonly AvatarProfile[]): Promise<AgentResult<AdAvatarProfile>> {
    Trace.line(import.meta.url, "AdAvatarProfiler.profile", { segment, ads: ads.length, market });
    const firsts = AdScripts.group(ads).map((script) => script[0]!);
    const ids = ads.map((ad) => ad.id);
    const cited = (p: AdAvatarProfile) => p.quote_ad_ids.filter((id) => !ids.includes(id)).map((id) => `ad ${id} is not one of this segment's ads; copy ids exactly`);
    const request = {
      agentId: `ad_avatar:${number}`,
      system: AD_AVATAR_SYSTEM,
      tools: [],
      maxTurns: AdAvatarProfiler.MAX_TURNS,
      reasoning: "low" as const,
    };
    const segmentLines = [`Audience segment: ${segment}. ${ads.length} ads, ${firsts.length} distinct copies:`, ...firsts.map(AdAvatarProfiler.line)];
    if (market !== "same_buyer") {
      return context.agent({ ...request, instructions: segmentLines.join("\n"), submission: { schema: AdAvatarProfileSchema, describe: "Hand back the avatar these ads are aimed at.", check: cited } });
    }
    const keys = buyers.map((buyer) => buyer.key);
    const listed = (p: AdAvatarProfile) => (p.same_buyer?.review_avatar && !keys.includes(p.same_buyer.review_avatar) ? [`review_avatar ${p.same_buyer.review_avatar} is not one of the client's avatars; use a key exactly as listed, or null`] : []);
    return context.agent({
      ...request,
      instructions: [...segmentLines, "", SAME_BUYER_INSTRUCTION, ...buyers.map((buyer) => `- ${buyer.key}: ${buyer.name}. ${buyer.description}`)].join("\n"),
      submission: { schema: SameBuyerAdAvatarProfileSchema, describe: "Hand back the avatar these ads are aimed at, and why it is the client's buyer.", check: (p) => [...cited(p), ...listed(p)] },
    });
  }

  private static line(ad: ReadAd): string {
    Trace.tick(import.meta.url, "AdAvatarProfiler.line");
    const r = ad.reading;
    const read = r ? `speaks to: ${r.avatar} | mechanism: ${r.mechanism ?? "none"} | promise: ${r.value_prop ?? "?"} | emotion: ${r.emotion} | handles: ${r.objections_handled.join("; ") || "none"}` : "not read";
    return `[${ad.id}] ${read} | "${ToolReply.clip(ad.copy, AdAvatarProfiler.HOOK_CHARS)}"`;
  }
}
