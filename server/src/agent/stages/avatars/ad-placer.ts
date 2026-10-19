import { AdPlacementSchema, type AdPlacement, type AvatarMemory, type ReadAd } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AD_PLACER_SYSTEM } from "../../prompt/text/avatars.js";

import { MemoryView } from "./memory-view.js";

/** Places one batch of competitor ads onto the avatars; code checks each ad is placed once, on an avatar that exists. */
export class AdPlacer {
  static readonly MAX_TURNS = 3;

  async place(context: RunContext, memory: AvatarMemory, ads: readonly ReadAd[], number: number): Promise<AgentResult<AdPlacement>> {
    Trace.line(import.meta.url, "AdPlacer.place", { ads: ads.length, number });
    const ids = ads.map((ad) => ad.id);
    const keys = new Set(memory.avatars.map((avatar) => avatar.key));
    return context.agent({
      agentId: `ad_placer:${number}`,
      system: AD_PLACER_SYSTEM,
      instructions: [MemoryView.memory(memory), `${ads.length} ads to place:`, MemoryView.ads(ads)].join("\n\n"),
      tools: [],
      maxTurns: AdPlacer.MAX_TURNS,
      submission: { schema: AdPlacementSchema, describe: "Hand back where each ad goes.", check: (placement) => AdPlacer.problems(placement, ids, keys) },
    });
  }

  static problems(placement: AdPlacement, ids: readonly string[], keys: ReadonlySet<string>): string[] {
    Trace.line(import.meta.url, "AdPlacer.problems", { given: ids.length, placed: placement.place.length });
    const placed = placement.place.map((item) => item.ad_id);
    return [
      ...ids.filter((id) => !placed.includes(id)).map((id) => `ad ${id} was given but not placed`),
      ...placed.filter((id) => !ids.includes(id)).map((id) => `ad ${id} was not given; copy each id exactly`),
      ...placed.filter((id, i) => placed.indexOf(id) !== i).map((id) => `ad ${id} is placed twice`),
      ...placement.place.filter((item) => item.avatar !== null && !keys.has(item.avatar)).map((item) => `ad ${item.ad_id}: avatar ${item.avatar} does not exist`),
    ];
  }
}
