import { Briefs, ProductFolders, stagePacketSchema, type Brief, type ResearchRun, type ResearchStore, type Scope, type StagePacket } from "../domain/index.js";
import { PacketDraft } from "../extract/index.js";
import { Trace } from "../trace/index.js";

/** Finds the stage-1 run for a brief, inside one scope, whose packet can name stage 2's targets. */
export class StageTwoHandoff {
  constructor(private readonly store: ResearchStore) {}

  forBrief(brief: Brief, scope: Scope): { run: ResearchRun; packet: StagePacket } | null {
    Trace.line(import.meta.url, "StageTwoHandoff.forBrief", { brief, scope });
    const product = this.store.products.byKey(Briefs.key(brief));
    if (!product) return null;
    const heads = this.store.products.runHeads(scope).filter((head) => head.stage === 1);
    for (const id of ProductFolders.runIds(heads, product.id)) {
      const run = this.store.getRun(id);
      if (!run) continue;
      const draft = PacketDraft.coerce(run.packet);
      if ("unparseable" in draft) continue;
      const parsed = stagePacketSchema.safeParse(draft.draft);
      if (!parsed.success || parsed.data.stage !== 1) continue;
      return { run, packet: parsed.data };
    }
    return null;
  }}
