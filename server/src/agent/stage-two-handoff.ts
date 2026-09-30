import { Briefs, ProductFolders, stagePacketSchema, type Brief, type ResearchRun, type ResearchStore, type Scope, type StagePacket } from "../domain/index.js";
import { PacketDraft } from "../extract/index.js";
import { Trace } from "../trace/index.js";

/** Finds the stage-1 run whose packet names stage 2's targets: the newest for a brief when stage 2 starts, and afterwards the one it was started from. */
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
      const packet = StageTwoHandoff.packetOf(run);
      if (packet) return { run, packet };
    }
    return null;
  }

  /** The stage-1 run a stage-2 run recorded as its source; null for a run from before the link was recorded. */
  forRun(stageTwo: ResearchRun): { run: ResearchRun; packet: StagePacket } | null {
    Trace.line(import.meta.url, "StageTwoHandoff.forRun", { runId: stageTwo.id, source: stageTwo.source_run_id });
    const run = stageTwo.source_run_id ? this.store.getRun(stageTwo.source_run_id) : null;
    const packet = run ? StageTwoHandoff.packetOf(run) : null;
    return run && packet ? { run, packet } : null;
  }

  private static packetOf(run: ResearchRun): StagePacket | null {
    Trace.line(import.meta.url, "StageTwoHandoff.packetOf", { runId: run.id });
    const draft = PacketDraft.coerce(run.packet);
    if ("unparseable" in draft) return null;
    const parsed = stagePacketSchema.safeParse(draft.draft);
    return parsed.success && parsed.data.stage === 1 ? parsed.data : null;
  }}
