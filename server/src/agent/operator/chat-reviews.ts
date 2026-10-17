import { Brands, ProductFolders, RunStatuses, Scope, type ResearchRun, type ResearchStore, type ReviewAnalysis } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";

/** What the chat needs of the review analyst: to start an analysis of a review-mining run. */
export interface ReviewAnalysisStarter {
  start(run: ResearchRun): Promise<ReviewAnalysis>;
}

/** Customer voice's review analysis started from the chat, on the product's newest delivered review-mining run, as the dashboard's button starts it: model calls only, nothing paid to Apify. */
export class ChatReviews {
  constructor(
    private readonly store: ResearchStore,
    private readonly analyst: ReviewAnalysisStarter,
    private readonly isLive: (runId: string) => boolean,
  ) {}

  async analyse(workspaceId: string, brand: string, productKey = ""): Promise<string> {
    Trace.line(import.meta.url, "ChatReviews.analyse", { workspaceId, brand });
    const products = (await this.store.products.list(Scope.of(workspaceId))).filter((p) => Brands.ofProduct(p.key) === brand);
    const product = productKey ? products.find((p) => p.key === productKey) : products.length === 1 ? products[0] : undefined;
    if (!product) throw new RunError(products.length === 0 ? "this brand has no research yet" : `name the product: one of ${products.map((p) => p.key).join(", ")}`);
    const heads = (await this.store.products.runHeads(Scope.of(workspaceId))).filter((h) => h.stage === 3);
    const runs = (await Promise.all(ProductFolders.runIds(heads, product.id).map((id) => this.store.getRun(id)))).filter((r): r is ResearchRun => !!r);
    const mined = runs.find((r) => RunStatuses.delivered(r.status));
    if (!mined) throw new RunError(`${product.label} has no customer voice to analyse; customer voice has to run first`);
    if (this.isLive(mined.id)) throw new RunError("customer voice is still mining reviews; analyse once it has finished");
    const analysis = await this.analyst.start(mined);
    return `Analysing ${product.label}'s mined reviews (run ${mined.id}): ${analysis.status}. It takes a couple of minutes; the dashboard updates by itself.`;
  }
}
