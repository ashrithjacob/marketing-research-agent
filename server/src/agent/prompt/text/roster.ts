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
  "For each in-scope target, in order:",
  "a. `amazon_find_product` with the target's name; pick the listing whose title " +
    "matches this brand and ingredient and has the highest `reviewsCount`. A target " +
    "with no matching listing is a named gap — never substitute a different target's " +
    "listing, and never mine a listing whose subject does not match.",
  "b. `amazon_reviews` on that listing **once per star band**, 3★ first.",
  "c. `trustpilot_reviews` for targets whose brand has a Trustpilot presence worth " +
    "mining — batch brands into one call where the tool allows it.",
  "",
  "Unticked targets are out of scope this run: name each one you skip as a gap on " +
    "`review_mining` (\"target <id> not approved for mining\"), never silence.",
].join("\n");
