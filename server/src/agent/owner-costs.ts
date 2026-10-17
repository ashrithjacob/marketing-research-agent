import type { ProductTruthInputs, ProductTruthPacket, ResearchStore } from "../domain/index.js";
import { ProductEconomics } from "../extract/index.js";
import { Trace } from "../trace/index.js";

/** The landed unit cost the owner saved on a product, given to a run that was not handed one: product truth's inputs, and the product truth market truth reads. */
export class OwnerCosts {
  constructor(private readonly store: ResearchStore) {}

  async intoInputs(inputs: ProductTruthInputs, workspaceId: string, productId: string): Promise<ProductTruthInputs> {
    Trace.line(import.meta.url, "OwnerCosts.intoInputs", { productId, given: inputs.landed_unit_cost !== null });
    if (inputs.landed_unit_cost !== null) return inputs;
    const saved = await this.store.productCosts.get(workspaceId, productId);
    return saved ? { ...inputs, landed_unit_cost: saved.landed_unit_cost, currency: saved.currency } : inputs;
  }

  /** Product truth as market truth reads it: with the owner's saved cost, and the margins it gives, where product truth ran without one. */
  async intoTruth(truth: ProductTruthPacket, workspaceId: string, productId: string): Promise<ProductTruthPacket> {
    Trace.line(import.meta.url, "OwnerCosts.intoTruth", { productId });
    if (truth.economics.operator?.landed_unit_cost) return truth;
    const saved = await this.store.productCosts.get(workspaceId, productId);
    if (!saved) return truth;
    const operator = { landed_unit_cost: saved.landed_unit_cost, currency: saved.currency, moq: truth.economics.operator?.moq ?? null, lead_time_days: truth.economics.operator?.lead_time_days ?? null };
    return { ...truth, economics: { ...truth.economics, operator, margins: truth.prices.map((price) => ProductEconomics.margin(price, operator)) } };
  }
}
