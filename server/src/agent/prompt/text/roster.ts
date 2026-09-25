import type { MiningTarget } from "../../../domain/index.js";

export const RELATION_LABEL: Record<MiningTarget["relation"], string> = {
  product: "champion product",
  direct: "direct competitor",
  indirect: "indirect competitor",
};

export const ROSTER_LEAD =
  "Stage 1 for this brief already named the champion product — the genre's " +
  "most-bought — and found the brands that share its active ingredient. " +
  "Mine **only** the targets below — a listing for anything else is out of " +
  "scope, however similar it sounds.";

export const ROSTER_METHOD = [
  "Work in two rounds, every in-scope target in each:",
  "a. `amazon_find_product` for every target not marked \"Amazon listing known\", " +
    "all in the same turn. Pick the listing whose title matches this brand and " +
    "ingredient and has the highest `reviewsCount`. A target with no matching listing " +
    "is a named gap — never substitute a different target's listing, and never mine a " +
    "listing whose subject does not match.",
  "b. ONE `mine_reviews` call with every chosen listing, plus the domain of each " +
    "brand with a Trustpilot presence worth mining. It covers all five star bands.",
  "",
  "Unticked targets are out of scope this run: name each one you skip as a gap on " +
    "`review_mining` (\"target <id> not approved for mining\"), never silence.",
].join("\n");
