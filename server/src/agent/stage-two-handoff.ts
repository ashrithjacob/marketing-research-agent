import { Briefs, stagePacketSchema, type Brief, type ResearchRun, type ResearchStore, type StagePacket } from "../domain/index.js";
import { PacketDraft } from "../extract/index.js";

/** Finds the stage-1 run for a brief whose packet can name stage 2's targets. */
export class StageTwoHandoff {
  constructor(private readonly store: ResearchStore) {}

  forBrief(brief: Brief): { run: ResearchRun; packet: StagePacket } | null {
    const key = Briefs.key(brief);
    for (const run of this.store.listRuns(200)) {
      if (run.stage !== 1 || Briefs.key(run.brief as Brief) !== key) continue;
      const draft = PacketDraft.coerce(run.packet);
      if ("unparseable" in draft) continue;
      const parsed = stagePacketSchema.safeParse(draft.draft);
      if (!parsed.success || parsed.data.stage !== 1) continue;
      return { run, packet: parsed.data };
    }
    return null;
  }}
