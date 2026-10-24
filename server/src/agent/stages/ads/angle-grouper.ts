import { AdAnglesSchema, type AdAngles, type ReadAd } from "../../../domain/index.js";
import { HookCutter } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { ANGLE_GROUPER_SYSTEM } from "../../prompt/text/ad-analysis.js";

/** One agent call that sees every read ad of the run and groups them into angles; code checks every ad sits in exactly one angle and every key is used once (docs/spec-ads-analysis.md D1). */
export class AngleGrouper {
  static readonly AGENT_ID = "angle_grouper";
  static readonly MAX_TURNS = 4;

  async group(context: RunContext, ads: readonly ReadAd[]): Promise<AgentResult<AdAngles>> {
    Trace.line(import.meta.url, "AngleGrouper.group", { ads: ads.length });
    const ids = ads.map((ad) => ad.id);
    return context.agent({
      agentId: AngleGrouper.AGENT_ID,
      system: ANGLE_GROUPER_SYSTEM,
      instructions: ["Ads to group into angles:", ...ads.map(AngleGrouper.line)].join("\n"),
      tools: [],
      maxTurns: AngleGrouper.MAX_TURNS,
      submission: { schema: AdAnglesSchema, describe: "Hand back the angles, every ad in exactly one.", check: (angles) => AngleGrouper.problems(angles, ids) },
    });
  }

  static problems(grouping: AdAngles, ids: readonly string[]): string[] {
    Trace.line(import.meta.url, "AngleGrouper.problems", { angles: grouping.angles.length, given: ids.length });
    const placed = grouping.angles.flatMap((angle) => angle.ad_ids);
    const keys = grouping.angles.map((angle) => angle.key);
    const problems = ids.filter((id) => !placed.includes(id)).map((id) => `ad ${id} is in no angle`);
    problems.push(...[...new Set(placed.filter((id) => !ids.includes(id)))].map((id) => `ad ${id} was not given; copy each id exactly`));
    problems.push(...[...new Set(placed.filter((id, i) => ids.includes(id) && placed.indexOf(id) !== i))].map((id) => `ad ${id} is in more than one angle`));
    problems.push(...[...new Set(keys.filter((key, i) => keys.indexOf(key) !== i))].map((key) => `angle key ${key} is used twice`));
    return problems;
  }

  private static line(ad: ReadAd): string {
    Trace.tick(import.meta.url, "AngleGrouper.line");
    const reading = ad.reading!;
    return `[${ad.id}] ${ad.advertiser} | ${reading.claim_type} | mechanism: ${reading.mechanism ?? "none"} | for: ${reading.avatar} | "${HookCutter.cut(ad.copy)}"`;
  }
}
