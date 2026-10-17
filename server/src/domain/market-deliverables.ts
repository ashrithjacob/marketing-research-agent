import type { FieldsDeliverable } from "./deliverable.js";

const PASS = { kind: "one_of" as const, values: ["pass", "fail", "unknown"] };

export const MARKET_SIZE_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "tam_sam",
  fields: [
    { key: "tam", record: "measurement", required: true, brief: "the total market, built up from people, how many have the problem, and what they spend", describe: "`record_measurement`, `metric` \"tam\": the total addressable market for the category, `unit` currency and scale, `period` the year" },
    { key: "sam", record: "measurement", required: true, brief: "the part of it this product can actually reach, at its price, through its channels, within its claim limits", describe: "`record_measurement`, `metric` \"sam\": the part this product can reach through its channels, at its price, under its claim limits" },
    { key: "derivation", record: "attribute", required: true, describe: "how the TAM was built upward: population × prevalence × willingness to pay, each number with where it came from; not a report's headline figure" },
    { key: "sam_assumptions", record: "attribute", required: true, describe: "the channels, price point and claim limits the SAM assumes, named explicitly" },
  ],
};

export const OFFERS_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "offers",
  fields: [
    { key: "price_ladder", record: "attribute", required: true, brief: "each direct competitor's price per pack and per serving, and where each anchors", describe: "each direct competitor's price per pack and per serving, and where each anchors, separated by \" \\| \"" },
    { key: "subscription_terms", record: "attribute", required: true, brief: "each competitor's subscription discount and terms", describe: "each competitor's subscription discount and terms, separated by \" \\| \"" },
    { key: "guarantees", record: "attribute", required: true, brief: "each competitor's guarantee and how long it lasts", describe: "each competitor's guarantee and its length, separated by \" \\| \"" },
    { key: "funnel_shapes", record: "attribute", required: true, describe: "the funnel each brand uses: advertorial, long-form sales page, direct to product, quiz, creator-led" },
    { key: "trials_and_bundles", record: "attribute", required: false, describe: "free trials, samples and bundle configurations" },
    { key: "dominant_pattern", record: "attribute", required: true, describe: "the offer most of the direct set makes, as a structure, not a judgement" },
    { key: "outliers", record: "attribute", required: false, describe: "the offers that break the pattern, and who makes them" },
  ],
};

export const SOPHISTICATION_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "sophistication",
  fields: [
    { key: "ad_elements", record: "ad_elements", required: true, brief: "which persuasion elements each competitor's ads use", describe: "`record_ad_elements`, one row per competitor ad or page you read: its brand, its source, and every element it uses" },
    { key: "stage", record: "attribute", required: true, describe: "the market's sophistication stage: the digit 1 to 5 first, then the evidence for it. It is counted from your ad tags: the most advanced element at least half the brands use", rule: { kind: "stage_from_elements" } },
    { key: "claims_running", record: "attribute", required: true, brief: "the claims the direct competitors run, word for word, and how many brands make each", describe: "the claims the direct set runs, word for word, with how many brands make each, separated by \" \\| \"" },
    { key: "escalation", record: "attribute", required: true, describe: "how far the leading claim has escalated and how long it has run, from first-seen dates" },
  ],
};

export const BREAKING_POINT_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "breaking_point",
  fields: [
    { key: "moments", record: "attribute", required: true, describe: "one row per moment: a specific incident that made someone start looking, as a person would recognise having lived it, citing where it was reported" },
    { key: "seasonality", record: "attribute", required: false, describe: "when in the year demand rises, from the category data" },
    { key: "buyer_stages", record: "buyer_stage", required: true, brief: "where the buyers you read stand, from beginner to hopeless", describe: "`record_buyer_stage`, one row per customer voice you read (a review, a forum post): its source, who it is, and their stage" },
  ],
};

export const GATE_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "viability",
  fields: [
    { key: "size", record: "attribute", required: true, describe: "\"pass\", \"fail\" or \"unknown\" first, then one plain sentence a shop owner reads at a glance, then the detail with its sources: is the SAM large enough for a plausible revenue target at a plausible share?", rule: PASS, reword: true },
    { key: "margin", record: "attribute", required: true, describe: "\"pass\", \"fail\" or \"unknown\" first, then one plain sentence a shop owner reads at a glance, then the detail with its sources: does the margin at a price the market accepts leave room for what the category pays to acquire a customer?", rule: PASS, reword: true },
    { key: "mechanism_availability", record: "attribute", required: true, describe: "\"pass\", \"fail\" or \"unknown\" first, then one plain sentence a shop owner reads at a glance, then the detail with its sources: at this sophistication stage, is there a mechanism, form or positioning not already taken?", rule: PASS, reword: true },
    { key: "claim_room", record: "attribute", required: true, describe: "\"pass\", \"fail\" or \"unknown\" first, then one plain sentence a shop owner reads at a glance, then the detail with its sources: do the claim limits, given the doses, still allow a proposition worth making?", rule: PASS, reword: true },
    { key: "structural_churn", record: "attribute", required: true, describe: "\"pass\", \"fail\" or \"unknown\" first, then one plain sentence a shop owner reads at a glance, then the detail with its sources: does the refill interval fit the time to effect?", rule: PASS, reword: true },
    { key: "verdict", record: "attribute", required: true, describe: "\"go\", \"reposition\" or \"drop\" first, then one plain sentence a shop owner reads at a glance, then the detail with its sources: one failed criterion generally means reposition, two or more drop; say what would settle each unknown", rule: { kind: "one_of", values: ["go", "reposition", "drop"] }, reword: true },
  ],
};
