import { AvatarVerdictsSchema, type AvatarMemory, type AvatarVerdicts, type ReadAd } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AVATAR_JUDGE_SYSTEM } from "../../prompt/text/avatars.js";

import { MemoryView } from "./memory-view.js";

/** Gives each avatar its awareness level, confidence, standing and the competitors' best angle on it; code checks every avatar is judged once. */
export class AvatarJudge {
  static readonly MAX_TURNS = 3;
  static readonly AGENT_ID = "avatar_judge";

  async judge(context: RunContext, memory: AvatarMemory, ads: readonly ReadAd[]): Promise<AgentResult<AvatarVerdicts>> {
    Trace.line(import.meta.url, "AvatarJudge.judge", { avatars: memory.avatars.length, ads: ads.length });
    const keys = memory.avatars.map((avatar) => avatar.key);
    const placed = ads.filter((ad) => memory.avatars.some((avatar) => avatar.ad_ids.includes(ad.id)));
    return context.agent({
      agentId: AvatarJudge.AGENT_ID,
      system: AVATAR_JUDGE_SYSTEM,
      instructions: [MemoryView.memory(memory), placed.length > 0 ? `The competitor ads placed on them:\n${MemoryView.ads(placed)}` : "No competitor ads were placed on any avatar."].join("\n\n"),
      tools: [],
      maxTurns: AvatarJudge.MAX_TURNS,
      submission: { schema: AvatarVerdictsSchema, describe: "Hand back one verdict per avatar.", check: (verdicts) => AvatarJudge.problems(verdicts, keys) },
    });
  }

  static problems(verdicts: AvatarVerdicts, keys: readonly string[]): string[] {
    Trace.line(import.meta.url, "AvatarJudge.problems", { keys: keys.length });
    const judged = verdicts.verdicts.map((verdict) => verdict.key);
    return [
      ...keys.filter((key) => !judged.includes(key)).map((key) => `avatar ${key} has no verdict`),
      ...judged.filter((key) => !keys.includes(key)).map((key) => `avatar ${key} does not exist`),
      ...judged.filter((key, i) => judged.indexOf(key) !== i).map((key) => `avatar ${key} is judged twice`),
    ];
  }
}
