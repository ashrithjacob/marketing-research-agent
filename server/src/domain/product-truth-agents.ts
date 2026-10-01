import type { FindingKind } from "./finding-kinds.js";
import type { Node } from "./nodes.js";

export const PRODUCT_TRUTH_AGENTS = ["formula", "mechanism", "dose_vs_study", "claim_limits", "cogs_refills"] as const;
export type ProductTruthAgent = (typeof PRODUCT_TRUTH_AGENTS)[number];

/** The rows code writes when a product-truth run starts: what the operator typed, and a gap for each input left blank. */
export const OPERATOR_AGENT = "operator";

export interface ProductTruthAgentSpec {
  node: Node;
  records: readonly FindingKind[];
  after: readonly ProductTruthAgent[];
  maxTurns: number;
}

export const PRODUCT_TRUTH_AGENT_SPECS: Readonly<Record<ProductTruthAgent, ProductTruthAgentSpec>> = {
  formula: { node: "dose_vs_study", records: ["source", "active", "regimen", "gap"], after: [], maxTurns: 10 },
  mechanism: { node: "mechanism", records: ["source", "mechanism", "gap"], after: ["formula"], maxTurns: 15 },
  dose_vs_study: { node: "dose_vs_study", records: ["source", "dose_study", "gap"], after: ["formula"], maxTurns: 15 },
  claim_limits: { node: "claim_limits", records: ["source", "claim_limit", "gap"], after: ["dose_vs_study"], maxTurns: 20 },
  cogs_refills: { node: "cogs_refills", records: ["source", "price_point", "gap"], after: ["mechanism"], maxTurns: 8 },
};
