import { Briefs, ProductFolders, RunStatuses, productTruthPacketSchema, stagePacketSchema, type Brief, type ProductTruthPacket, type ResearchStore, type Scope, type Source, type StagePacket } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { StageOneHandoff } from "./stage-one-handoff.js";

/** What market truth reads: the product's newest delivered stage 1, product truth and, when it ran, customer voice, with every source they cite once. */
export interface MarketEvidence {
  sourceRunId: string;
  stageOne: StagePacket;
  truth: ProductTruthPacket;
  voice: StagePacket | null;
  sources: Source[];
}

/** Gathers a brief's earlier stages for market truth; refuses when stage 1 or product truth has not delivered, since the gate needs both. */
export class MarketTruthInputs {
  constructor(
    private readonly store: ResearchStore,
    private readonly handoff: StageOneHandoff,
  ) {}

  async load(brief: Brief, scope: Scope): Promise<MarketEvidence | { error: string }> {
    Trace.line(import.meta.url, "MarketTruthInputs.load");
    const one = await this.handoff.forBrief(brief, scope);
    if (!one) return { error: "market truth reads a completed stage-1 run, and this brief has none" };
    const truth = productTruthPacketSchema.safeParse((await this.newest(brief, scope, 2))?.packet);
    if (!truth.success) return { error: "market truth reads a completed product-truth run, and this brief has none" };
    const voiced = stagePacketSchema.safeParse((await this.newest(brief, scope, 3))?.packet);
    const voice = voiced.success ? voiced.data : null;
    const seen = new Set<string>();
    const sources = [...one.packet.sources, ...truth.data.sources, ...(voice?.sources ?? [])].filter((s) => s.admitted && !seen.has(s.id) && seen.add(s.id));
    return { sourceRunId: one.run.id, stageOne: one.packet, truth: truth.data, voice, sources };
  }

  private async newest(brief: Brief, scope: Scope, stage: number) {
    Trace.line(import.meta.url, "MarketTruthInputs.newest", { stage });
    const product = await this.store.products.byKey(Briefs.key(brief));
    if (!product) return null;
    const heads = (await this.store.products.runHeads(scope)).filter((h) => h.stage === stage && RunStatuses.delivered(h.status));
    for (const id of ProductFolders.runIds(heads, product.id)) {
      const run = await this.store.getRun(id);
      if (run && run.contract === null) return run;
    }
    return null;
  }
}
