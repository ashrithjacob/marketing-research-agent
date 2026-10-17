import { Briefs, ProductFolders, RunStatuses, productTruthPacketSchema, stagePacketSchema, type Brief, type ProductTruthPacket, type ResearchRun, type ResearchStore, type Scope, type StagePacket, type StoredRunReview } from "../domain/index.js";
import { FieldsCheck } from "../extract/index.js";
import { Trace } from "../trace/index.js";

/** What customer truth reads: the product's newest delivered product truth, market truth and customer voice, with the reviews customer voice mined. */
export interface CustomerEvidence {
  sourceRunId: string;
  truth: ProductTruthPacket;
  market: StagePacket;
  verdict: string;
  reviews: StoredRunReview[];
}

/** Gathers a brief's earlier stages for customer truth; refuses without market truth, on a "drop" verdict, and without mined reviews (decided with the owner 2026-10-16). */
export class CustomerTruthInputs {
  constructor(private readonly store: ResearchStore) {}

  async load(brief: Brief, scope: Scope): Promise<CustomerEvidence | { error: string }> {
    Trace.line(import.meta.url, "CustomerTruthInputs.load");
    const truth = productTruthPacketSchema.safeParse((await this.newest(brief, scope, 2))?.packet);
    if (!truth.success) return { error: "customer truth reads a completed product-truth run, and this brief has none" };
    const marketRun = await this.newest(brief, scope, 4);
    const market = stagePacketSchema.safeParse(marketRun?.packet);
    if (!marketRun || !market.success) return { error: "customer truth reads a completed market-truth run, and this brief has none; offer market truth first" };
    const verdict = CustomerTruthInputs.verdict(market.data);
    if (verdict === "drop") return { error: "market truth's verdict is drop; customer truth runs on go or reposition" };
    const voice = await this.newest(brief, scope, 3);
    const reviews = voice ? await this.store.listRunReviews(voice.id) : [];
    if (reviews.length === 0) return { error: "customer truth reads the reviews customer voice mined, and this product has none yet; offer customer voice first (it is paid)" };
    return { sourceRunId: marketRun.id, truth: truth.data, market: market.data, verdict, reviews };
  }

  static verdict(market: StagePacket): string {
    Trace.line(import.meta.url, "CustomerTruthInputs.verdict");
    const value = market.attributes.find((a) => a.node === "viability" && a.key === "verdict")?.value ?? "";
    return ["go", "reposition", "drop"].find((word) => FieldsCheck.oneOf(value, [word])) ?? "";
  }

  private async newest(brief: Brief, scope: Scope, stage: number): Promise<ResearchRun | null> {
    Trace.line(import.meta.url, "CustomerTruthInputs.newest", { stage });
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
