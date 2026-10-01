import { Briefs, ProductFolders, stagePacketSchema, type Brief, type ResearchRun, type ResearchStore, type Scope, type StagePacket } from "../domain/index.js";
import { PacketDraft } from "../extract/index.js";
import { Trace } from "../trace/index.js";

/** Finds the stage-1 run a later stage builds on: the newest completed one for a brief when that stage starts, and afterwards the one it was started from. */
export class StageOneHandoff {
  constructor(private readonly store: ResearchStore) {}

  forBrief(brief: Brief, scope: Scope): { run: ResearchRun; packet: StagePacket } | null {
    Trace.line(import.meta.url, "StageOneHandoff.forBrief", { brief, scope });
    const product = this.store.products.byKey(Briefs.key(brief));
    if (!product) return null;
    const heads = this.store.products.runHeads(scope).filter((head) => head.stage === 1);
    for (const id of ProductFolders.runIds(heads, product.id)) {
      const run = this.store.getRun(id);
      if (!run) continue;
      const packet = StageOneHandoff.packetOf(run);
      if (packet) return { run, packet };
    }
    return null;
  }

  /** The stage-1 run a later run recorded as its source; null for a run from before the link was recorded. */
  forRun(later: ResearchRun): { run: ResearchRun; packet: StagePacket } | null {
    Trace.line(import.meta.url, "StageOneHandoff.forRun", { runId: later.id, source: later.source_run_id });
    const run = later.source_run_id ? this.store.getRun(later.source_run_id) : null;
    const packet = run ? StageOneHandoff.packetOf(run) : null;
    return run && packet ? { run, packet } : null;
  }

  /** Whether a run of `stage` built on this stage-1 run has completed: review mining waits for product truth on the same stage-1 run. */
  hasCompleted(stage: number, sourceRunId: string, scope: Scope): boolean {
    Trace.line(import.meta.url, "StageOneHandoff.hasCompleted", { stage, sourceRunId });
    const source = this.store.getRun(sourceRunId);
    if (!source) return false;
    return this.store.products
      .runHeads(scope)
      .filter((head) => head.stage === stage && head.status === "completed" && head.product_id === source.product_id)
      .some((head) => this.store.getRun(head.id)?.source_run_id === sourceRunId);
  }

  private static packetOf(run: ResearchRun): StagePacket | null {
    Trace.line(import.meta.url, "StageOneHandoff.packetOf", { runId: run.id });
    const draft = PacketDraft.coerce(run.packet);
    if ("unparseable" in draft) return null;
    const parsed = stagePacketSchema.safeParse(draft.draft);
    return parsed.success && parsed.data.stage === 1 ? parsed.data : null;
  }
}
