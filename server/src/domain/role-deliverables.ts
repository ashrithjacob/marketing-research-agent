import type { FieldsDeliverable, ListDeliverable, PerItemDeliverable } from "./deliverable.js";
import { AD_PLATFORMS } from "./product-truth-rows.js";

export const CHAMPION_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: null,
  fields: [
    { key: "competitor_reference", record: "competitor_reference", required: true, describe: "the champion: name, form, actives, icp, the page it cites", how: "record it with record_reference, then call finish" },
  ],
};

export const PRODUCT_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "product_data",
  fields: [
    { key: "name", record: "attribute", required: true, describe: "the name as the product's own page writes it, nothing appended" },
    { key: "brand", record: "attribute", required: true, describe: "the brand" },
    { key: "form", record: "attribute", required: true, describe: "the form as the page states it (drops, capsules, gummies…)" },
    { key: "dose_per_serving", record: "attribute", required: true, describe: "the active amount per serving, with its unit" },
    { key: "servings_per_container", record: "attribute", required: true, describe: "servings per pack" },
    { key: "full_ingredient_panel", record: "attribute", required: true, describe: "every ingredient as listed, in order" },
    { key: "price", record: "attribute", required: true, describe: "price and currency for each pack size sold" },
    { key: "subscription_terms", record: "attribute", required: true, describe: "subscribe price, frequency, minimum orders, how to cancel — or \"none offered\"" },
    { key: "claims_made_on_own_site", record: "attribute", required: true, describe: "the claims the product page makes, word for word, separated by \" \\| \"" },
    { key: "coa_present", record: "attribute", required: true, describe: "\"yes — <where>\" if a certificate of analysis is published, else \"no\"" },
    { key: "ad_activity", record: "attribute", required: false, describe: "how many Meta ads, which pages run them, first and last seen" },
    { key: "ad_claims", record: "attribute", required: false, describe: "the claims the ads make, word for word, separated by \" \\| \"" },
  ],
};

export const CATEGORY_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "category_data",
  fields: [
    {
      key: "search_volume",
      record: "measurement",
      required: true,
      describe: "`record_measurement`, `metric` \"search_volume\" (or \"search_volume: <keyword>\"), `unit` \"searches\", `period` the year or month (\"2023\", \"2024-11\"). One row per period.",
      rule: { kind: "distinct_periods", min: 3 },
    },
    {
      key: "category_size",
      record: "measurement",
      required: true,
      describe: "`record_measurement`, `metric` \"category_size: <segment the source names>\", `value` as stated, `unit` currency and scale (\"USD billion\"), `period` the year it is for",
    },
    { key: "seasonality", record: "attribute", required: true, describe: "`record_attribute`, `key` \"seasonality\", the months or season demand peaks, in the source's words" },
    { key: "meta_ads_matching", record: "measurement", required: false, describe: "Meta ads matching the customer's problem in the brief's markets" },
  ],
};

export const COMPETITORS_DELIVERABLE: ListDeliverable = {
  shape: "list",
  node: "competitors",
  item: "competitor",
  classes: ["direct", "indirect"],
  parts: [
    { key: "icp_as_printed", required: true, describe: "who its own page says it is for and what it treats, word for word" },
    { key: "form_as_printed", required: true, describe: "what the product physically is, as printed" },
    { key: "price", required: false, describe: "price and currency" },
    { key: "positioning_copy", required: false, describe: "its headline, word for word" },
    { key: "ad_source_ids", required: false, describe: "its Meta ads, as ad_library sources" },
  ],
  stop: { kind: "saturation", quietRun: 3 },
};

export const FORMULA_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "dose_vs_study",
  fields: [
    { key: "actives", record: "active", required: true, describe: "each active ingredient: name, amount per serving, unit and form as printed", how: "record each active with record_active" },
    { key: "servings_per_day", record: "regimen", required: true, describe: "servings a day, from the label's main directions", how: "record it with record_regimen", rule: { kind: "number_on_latest" } },
    { key: "servings_per_container", record: "regimen", required: true, describe: "servings in one container", how: "record it with record_regimen", rule: { kind: "number_on_latest" } },
  ],
};

export const MECHANISM_DELIVERABLE: PerItemDeliverable = {
  shape: "per_item",
  node: "mechanism",
  over: { from: "ledger", kind: "active", by: "name" },
  needs: [
    { key: "mechanism", record: "mechanism", match: ["active"], describe: "record it with record_mechanism" },
    { key: "time_to_effect", record: "mechanism", match: ["active"], field: "time_to_effect", describe: "record it on its mechanism row" },
  ],
  oneMarked: { key: "carrier", record: "mechanism", field: "story_weight", value: "carrier", describe: "mark the active the product's story rests on as story_weight \"carrier\"" },
};

export const DOSE_DELIVERABLE: PerItemDeliverable = {
  shape: "per_item",
  node: "dose_vs_study",
  over: { from: "ledger", kind: "active", by: "name", only: { present: "amount", absent: "in_blend" } },
  needs: [{ key: "dose", record: "dose_study", match: ["active"], describe: "record its studied dose with record_dose_study" }],
};

export const CLAIMS_DELIVERABLE: PerItemDeliverable = {
  shape: "per_item",
  node: "claim_limits",
  over: { from: "markets", times: AD_PLATFORMS },
  needs: [{ key: "claims", record: "claim_limit", match: ["market", "platform"], describe: "record its permitted and forbidden claims with record_claim_limits" }],
};

export const COGS_DELIVERABLE: FieldsDeliverable = {
  shape: "fields",
  node: "cogs_refills",
  fields: [{ key: "prices", record: "price_point", required: true, describe: "every price the product sells at", how: "record each price with record_price" }],
};
