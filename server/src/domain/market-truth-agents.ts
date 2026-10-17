export const MARKET_TRUTH_AGENTS = ["market_size", "offers", "sophistication", "breaking_point", "gate"] as const;
export type MarketTruthAgent = (typeof MARKET_TRUTH_AGENTS)[number];

/** The market-truth agents that gather side by side; the gate reads what they found, after them. */
export const MARKET_TRUTH_GATHERERS: readonly MarketTruthAgent[] = ["market_size", "offers", "sophistication", "breaking_point"];
