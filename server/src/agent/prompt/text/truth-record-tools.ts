const REPLACES = "Recording it again under the same key replaces the earlier row.";

export const TRUTH_RECORD_TOOLS = [
  {
    name: "record_active",
    kind: "active",
    description:
      "Record one active ingredient off the label: name as printed, amount per serving as a number or null " +
      "when the label states none, unit as printed, form (salt, extract ratio, standardisation) as printed, and " +
      "in_blend: true when it sits in a proprietary blend whose split is not given. " + REPLACES + " Keyed by name. " +
      'Example: {"name":"Bromelain","amount":100,"unit":"mg","form":"2400 GDU/g","in_blend":false,"source_id":"sha256:1c9d…"}',
  },
  {
    name: "record_regimen",
    kind: "regimen",
    description:
      "Record how the label says to take the product: servings_per_day from its main directions, and " +
      "servings_per_container, each a number or null. There is one; " + REPLACES + " Example: " +
      '{"servings_per_day":2,"servings_per_container":30,"directions_as_printed":"Take 1 mL in water twice daily",' +
      '"source_id":"sha256:1c9d…"}',
  },
  {
    name: "record_mechanism",
    kind: "mechanism",
    description:
      "Record how one active works, as a source states it. `active` is copied word for word from the recorded " +
      "actives. time_to_effect is null when no source states one. story_weight is \"carrier\" or \"supporting\". " +
      REPLACES + " Keyed by active. Example: " +
      '{"active":"Bromelain","pathway":"a protease that breaks down mucus proteins and lowers bradykinin",' +
      '"time_to_effect":{"value":2,"unit":"weeks"},"magnitude":"CRP down 35% vs placebo at 14 days (n=40)",' +
      '"story_weight":"carrier","source_id":"sha256:9c04…"}',
  },
  {
    name: "record_dose_study",
    kind: "dose_study",
    description:
      "Record the human study one active's dose is measured against. `active` is copied word for word from the " +
      "recorded actives; studied_daily_dose is per day, in the label's unit for that active, or null when the " +
      "study states none; human_study false when only animal or lab work exists. Code computes the ratio and class. " +
      REPLACES + " Keyed by active. Example: " +
      '{"active":"Bromelain","studied_daily_dose":600,"unit":"mg","studied_form":"oral bromelain capsules",' +
      '"study":"Smith 2021, RCT, n=40","human_study":true,"form_match":"same enzyme, same oral route",' +
      '"source_id":"sha256:9c04…"}',
  },
  {
    name: "record_claim_limits",
    kind: "claim_limit",
    description:
      "Record what one market's rules and one ad platform's policy allow this product to claim. `market` is copied " +
      "word for word from the brief; platform is \"meta\" or \"google_ads\". permitted and forbidden are claim " +
      "constructions written out as ad copy. " + REPLACES + " Keyed by market and platform. Example: " +
      '{"market":"US","platform":"meta","permitted":["Supports respiratory health*"],' +
      '"forbidden":["Cures chronic cough","Clinically proven to clear your lungs"],' +
      '"disclaimers":["*These statements have not been evaluated by the Food and Drug Administration."],' +
      '"evidence_standard":"FTC: competent and reliable scientific evidence for every health claim",' +
      '"source_ids":["sha256:4b1e…","sha256:77aa…"]}',
  },
  {
    name: "record_price",
    kind: "price_point",
    description:
      "Record one price the product sells at: amount as a number, currency as an ISO code, units = how many " +
      "containers the price buys, subscription true for a subscription price. " + REPLACES + " Keyed by label. " +
      'Example: {"label":"3 bottles","amount":69.95,"currency":"USD","units":3,"subscription":false,' +
      '"market":"US","source_id":"sha256:1c9d…"}',
  },
] as const;
