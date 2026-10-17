import { Briefs, Brands, ProductFolders, RunStatuses, STAGE_NODES, SavedPlans, Scope, productTruthInputsSchema, runRequestSchema, type Brief, type PlanBook, type Product, type ResearchRun, type ResearchStore, type RunRequest } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { CustomerTruthInputs } from "../customer-truth-inputs.js";
import { RunError } from "../errors.js";

import type { PlanStages } from "./plan-stages.js";

/** What a later stage may be started with: the owner's approved brief as notes, product truth's cost inputs, and whether a stage that already delivered is to be run fresh because the owner asked. */
export interface LaterStageStart {
  product?: string;
  notes?: string;
  inputs?: { landed_unit_cost?: number; currency?: string };
  fresh?: boolean;
}

/** Stages 2 to 5 started from the chat on what came before. Market truth (4) is a stage run on stages 1 and 2; customer truth (5) one on product truth, market truth and customer voice's reviews. Product truth (2) and customer voice (3) are a plan with no stage-1 tasks of its own, pointing at the product's delivered stage 1, so the plan steps start product truth and put customer voice's paid pulls on an approval card, as a plan with tasks would. */
export class ChatStages {
  constructor(
    private readonly store: ResearchStore,
    private readonly plans: PlanBook,
    private readonly stages: PlanStages,
    private readonly launch: (request: RunRequest, workspaceId: string) => Promise<string>,
  ) {}

  /** The product and stage-1 brief a later stage builds on, or why it cannot run: checked before a brief is shown and again when it is approved. */
  async subject(workspaceId: string, brand: string, stage: number, start: LaterStageStart = {}): Promise<{ product: Product; brief: Brief; one: ResearchRun; two: ResearchRun | null }> {
    Trace.line(import.meta.url, "ChatStages.subject", { workspaceId, brand, stage });
    if (stage !== 2 && stage !== 3 && stage !== 4 && stage !== 5) throw new RunError("this runs product truth (2), market truth (4), customer voice (3) or customer truth (5); market research is stage 1");
    const product = await this.product(workspaceId, brand, start.product ?? "");
    const one = await this.delivered(workspaceId, product.id, 1);
    if (!one) throw new RunError(`${product.label} has no delivered market research to build on; run it first`);
    const two = await this.delivered(workspaceId, product.id, 2);
    if (stage !== 2 && !two) throw new RunError(`${stage === 4 ? "market truth's gate" : stage === 5 ? "customer truth" : "customer voice"} needs product truth, which ${product.label} does not have yet; offer product truth first`);
    const brief = Briefs.normalise({ ...(one.brief as unknown as Brief), notes: "" });
    const customer = stage === 5 ? await new CustomerTruthInputs(this.store).load(brief, Scope.of(workspaceId)) : null;
    if (customer && "error" in customer) throw new RunError(customer.error);
    const done = stage === 2 ? two : await this.delivered(workspaceId, product.id, stage);
    if (done && !start.fresh) throw new RunError(`${product.label} already has this stage from ${done.created_at.slice(0, 10)}; run it again only when the owner asks for a fresh run`);
    return { product, brief, one, two };
  }

  async start(workspaceId: string, brand: string, stage: number, start: LaterStageStart = {}): Promise<string> {
    Trace.line(import.meta.url, "ChatStages.start", { workspaceId, brand, stage });
    const { product, brief: base, one, two } = await this.subject(workspaceId, brand, stage, start);
    const brief = { ...base, notes: start.notes?.trim() ?? "" };
    if (stage === 4 || stage === 5) return `Started ${stage === 4 ? "market truth" : "customer truth"} for ${product.label}, run ${await this.launch(runRequestSchema.parse({ brief, nodes: [...STAGE_NODES[stage]] }), workspaceId)}.`;
    const inputs = stage === 2 && start.inputs?.landed_unit_cost !== undefined ? { inputs: productTruthInputsSchema.parse({ landed_unit_cost: start.inputs.landed_unit_cost, currency: start.inputs.currency ?? "" }) } : {};
    const draft = await this.plans.create(workspaceId, brief, SavedPlans.tasks(brief).map((t) => ({ ...t, selected: false })), [
      { stage: 2, title: "Product truth", selected: true, run_id: stage === 3 ? (two?.id ?? "") : "", error: "", ...inputs },
      { stage: 3, title: "Review mining", selected: stage === 3, run_id: "", error: "" },
    ]);
    const plan = await this.plans.save({ ...draft, status: "approved", stage_one_run_id: one.id });
    await this.stages.follow(plan.id);
    const after = (await this.plans.get(Scope.everything, plan.id))!.stages.find((s) => s.stage === stage)!;
    if (after.run_id) return `Started ${stage === 2 ? "product truth" : "customer voice"} for ${product.label}, run ${after.run_id}.`;
    return `${stage === 2 ? "Product truth" : "Customer voice"} for ${product.label}: ${after.error || "waiting"}.`;
  }

  async product(workspaceId: string, brand: string, productKey: string): Promise<Product> {
    Trace.line(import.meta.url, "ChatStages.product", { brand, productKey });
    const products = (await this.store.products.list(Scope.of(workspaceId))).filter((p) => Brands.ofProduct(p.key) === brand);
    const chosen = productKey ? products.find((p) => p.key === productKey) : products.length === 1 ? products[0] : undefined;
    if (!chosen) throw new RunError(products.length === 0 ? "this brand has no research yet; run market research first" : `name the product: one of ${products.map((p) => p.key).join(", ")}`);
    return chosen;
  }

  private async delivered(workspaceId: string, productId: string, stage: number): Promise<ResearchRun | null> {
    Trace.line(import.meta.url, "ChatStages.delivered", { productId, stage });
    const heads = (await this.store.products.runHeads(Scope.of(workspaceId))).filter((h) => h.stage === stage && RunStatuses.delivered(h.status));
    for (const id of ProductFolders.runIds(heads, productId)) {
      const run = await this.store.getRun(id);
      if (run && run.contract === null) return run;
    }
    return null;
  }
}
