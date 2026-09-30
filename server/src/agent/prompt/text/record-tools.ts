const REPLACES = "Recording it again under the same key replaces the earlier row.";

export const RECORD_TOOLS = [
  {
    name: "record_source",
    kind: "source",
    description:
      "Record one source you fetched. `id` is the source_id web_fetch returned, verbatim. " +
      "Record rejected sources too, with admitted: false. " + REPLACES + " Example: " +
      '{"id":"sha256:1c9d…","url":"https://brand.example/products/x","title":"X 400mg — 90 capsules",' +
      '"kind":"first_party","publisher":"brand.example","fetched_at":"2026-09-10T09:11:40Z",' +
      '"marketing":true,"admitted":true,"admission_reason":"first_party — the product\'s own page",' +
      '"archived":true,"node":"product_data"}',
  },
  {
    name: "record_measurement",
    kind: "measurement",
    description:
      "Record one number a source states, with its unit and period. The id is assigned for you. " +
      'Example: {"node":"category_data","metric":"search_volume","value":12100,' +
      '"unit":"searches","period":"2025-09","source_id":"sha256:9c04…"}',
  },
  {
    name: "record_attribute",
    kind: "attribute",
    description:
      "Record one field read off a page: your task's keys first, then any other fact under a key you name. " +
      REPLACES + ' The id is assigned for you. Example: {"node":"product_data","key":"dose_per_serving",' +
      '"value":"400 mg per 2 capsules","source_id":"sha256:1c9d…"}',
  },
  {
    name: "record_reference",
    kind: "competitor_reference",
    description:
      "Record the champion product every competitor is measured against. There is one; " +
      "recording it again replaces it. With a url brief the champion is that site's product and " +
      "there is no ranking: runner_up_name and runner_up_reviews are null. amazon_url is the " +
      "champion's Amazon listing, or \"\" when it has none. Example: " +
      '{"name":"MagnaCalm Glycinate 400mg","form":"capsule","form_as_printed":"90 vegan capsules",' +
      '"actives":["magnesium glycinate"],"source_id":"sha256:1c9d…","reviews_count":18234,' +
      '"runner_up_name":"CalmWell Glycinate","runner_up_reviews":9120,' +
      '"amazon_url":"https://www.amazon.com/dp/B0EXAMPLE1"}',
  },
  {
    name: "record_competitor",
    kind: "competitor",
    description:
      "Record one competitor, read off its own page. `id` is yours: c1, c2, …; " + REPLACES +
      " relation is checked against the champion's form. Example: " +
      '{"id":"c1","name":"CalmWell Magnesium Glycinate","brand":"CalmWell",' +
      '"url":"https://calmwell.example/mg","relation":"direct","form":"capsule",' +
      '"form_as_printed":"60 capsules","active_ingredients":[{"name_as_printed":"Magnesium ' +
      '(as glycinate)","name_normalised":"magnesium glycinate","dose":"400","unit":"mg",' +
      '"per":"2 capsules"}],"shared_actives":["magnesium glycinate"],"dose_per_serving":"400 mg",' +
      '"positioning_copy":"Sleep deeper, naturally.","price":"£14.99","price_per_dose":"£0.50",' +
      '"market":"UK","source_id":"sha256:5e21…","ad_source_ids":[]}',
  },
  {
    name: "record_saturation",
    kind: "saturation",
    description:
      "Record a node's saturation curve, the whole curve each time: one per node, and for " +
      "competitors one per class (\"direct\", \"indirect\"); every other node's class is null. " +
      REPLACES + ' Example: {"node":"category_data","class":null,"curve":[{"source_id":' +
      '"sha256:9c04…","new_themes":2,"cumulative_themes":2}],"stopped_because":' +
      '"three consecutive sources added no new theme"}',
  },
  {
    name: "record_node_status",
    kind: "node_status",
    description:
      "Record whether a node is complete, and which criterion was or was not met. One per node " +
      "in scope; " + REPLACES + ' Example: {"node":"product_data","status":"complete",' +
      '"done_criterion_met":true,"why":"9 of 10 checklist fields; COA gapped"}',
  },
  {
    name: "record_gap",
    kind: "gap",
    description:
      "Record one thing you could not find, and what it would take to get it. A run with no " +
      'gaps fails. Example: {"node":"product_data","missing":"no certificate of analysis ' +
      'published","would_need":"a batch COA on request","blocking":false}',
  },
] as const;

export const RETRACT_DESCRIPTION =
  "Withdraw one recorded row by its id (e.g. ex14), with the reason. Rows are never deleted: " +
  "a retracted row stays in the ledger and leaves the packet.";

export const FINISH_DESCRIPTION =
  "Check your part of the ledger against the contract. Call it alone, once your task is " +
  "recorded with its status and its gaps. It answers FINISHED, which ends your work, or the " +
  "numbered problems to fix with record_* or retract before calling it again. Five checks; " +
  "after the fifth you end with what the ledger holds.";

export const READ_LEDGER_DESCRIPTION =
  "Read the run's shared ledger: every agent's live rows, or only one agent's (`agent`) or one " +
  "kind's (`kind`). Agents are champion, product, competitors and category. You can read any " +
  "row; you can replace or retract only rows you recorded.";

export const WAIT_FOR_DESCRIPTION =
  "Wait until another agent has recorded a row of `kind` in the ledger, checking every 15 " +
  "seconds, then get those rows back. Use it only when you cannot go on without that row. It " +
  "returns early if that agent has ended without recording one.";
