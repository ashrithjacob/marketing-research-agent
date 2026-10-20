import { AvatarVerdictsSchema, SOPHISTICATION_NAMES, type AvatarMemory, type AvatarVerdicts, type MarketAssessment, type ReadAd } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AVATAR_JUDGE_SYSTEM } from "../../prompt/text/avatars.js";

import { MemoryView } from "./memory-view.js";

/** Gives each avatar its awareness level, skepticism, confidence, standing and the competitors' best angle on it; code checks every avatar is judged once and cites only its own reviews. */
export class AvatarJudge {
  static readonly MAX_TURNS = 3;
  static readonly AGENT_ID = "avatar_judge";

  async judge(context: RunContext, memory: AvatarMemory, ads: readonly ReadAd[], market: MarketAssessment | null = null): Promise<AgentResult<AvatarVerdicts>> {
    Trace.line(import.meta.url, "AvatarJudge.judge", { avatars: memory.avatars.length, ads: ads.length });
    const placed = ads.filter((ad) => memory.avatars.some((avatar) => avatar.ad_ids.includes(ad.id)));
    return context.agent({
      agentId: AvatarJudge.AGENT_ID,
      system: AVATAR_JUDGE_SYSTEM,
      instructions: [
        ...(market ? [`The market, from stage 4: sophistication stage ${market.sophistication_stage} of 5 (${SOPHISTICATION_NAMES[market.sophistication_stage]}). ${market.why}`] : []),
        MemoryView.memory(memory),
        placed.length > 0 ? `The competitor ads placed on them:\n${MemoryView.ads(placed)}` : "No competitor ads were placed on any avatar.",
      ].join("\n\n"),
      tools: [],
      maxTurns: AvatarJudge.MAX_TURNS,
      submission: { schema: AvatarVerdictsSchema, describe: "Hand back one verdict per avatar.", check: (verdicts) => AvatarJudge.problems(verdicts, memory) },
    });
  }

  static problems(verdicts: AvatarVerdicts, memory: AvatarMemory): string[] {
    Trace.line(import.meta.url, "AvatarJudge.problems", { avatars: memory.avatars.length });
    const keys = memory.avatars.map((avatar) => avatar.key);
    const judged = verdicts.verdicts.map((verdict) => verdict.key);
    const own = new Map(memory.avatars.map((avatar) => [avatar.key, new Set(memory.avatars.filter((member) => member.key === avatar.key || member.parent === avatar.key).flatMap((member) => member.review_ids))]));
    const foreign = verdicts.verdicts.flatMap((verdict) => verdict.skepticism_review_ids.filter((id) => !own.get(verdict.key)?.has(id)).map((id) => `avatar ${verdict.key} cites review ${id}, which is not one of its reviews`));
    return [
      ...foreign,
      ...keys.filter((key) => !judged.includes(key)).map((key) => `avatar ${key} has no verdict`),
      ...judged.filter((key) => !keys.includes(key)).map((key) => `avatar ${key} does not exist`),
      ...judged.filter((key, i) => judged.indexOf(key) !== i).map((key) => `avatar ${key} is judged twice`),
    ];
  }
}
