export const PRODUCT_TRUTH_AGENTS = ["formula", "mechanism", "dose_vs_study", "claim_limits", "cogs_refills"] as const;
export type ProductTruthAgent = (typeof PRODUCT_TRUTH_AGENTS)[number];

/** The rows code writes when a product-truth run starts: what the operator typed, and a gap for each input left blank. */
export const OPERATOR_AGENT = "operator";
