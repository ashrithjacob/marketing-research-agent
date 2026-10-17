export const CUSTOMER_TRUTH_AGENTS = ["voices", "identity", "avatars", "awareness"] as const;
export type CustomerTruthAgent = (typeof CUSTOMER_TRUTH_AGENTS)[number];
