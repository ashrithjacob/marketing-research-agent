export const FORMULA_TASK = `## Your task: the formula

1. Record each active ingredient with \`record_active\`: \`name\` as printed,
   \`amount\` per serving as a number, \`unit\` as printed, \`form\` as printed
   (salt, extract ratio, standardisation), \`in_blend: true\` when it sits in a
   proprietary blend whose split is not given. Excipients — water, glycerin,
   alcohol, flavouring, preservatives — are not actives.
2. Stage 1's text for the panel and the dose is below. Where it gives no
   amounts, read the label again: the product page, its supplement-facts image
   text, the brand's FAQ, a retailer listing of the same product. When no
   source states an amount, record the active with \`amount: null\` — an
   undisclosed amount is a finding, not a failure.
3. Record the regimen once with \`record_regimen\`: \`servings_per_day\` from the
   label's main directions (quote them in \`directions_as_printed\`), and
   \`servings_per_container\` as a number — a 30 mL bottle at 1 mL a serving is
   30. Either may be null; then record_gap with missing
   "servings_per_day: <why>" or "servings_per_container: <why>".
4. File your sources and gaps under node \`dose_vs_study\`. Then call \`finish\`.`;

export const MECHANISM_TASK = `## Your task: how each active works

For every active listed below, \`record_mechanism\` with \`active\` copied word
for word from that list:

- \`pathway\` — in plain language, the receptor, enzyme or deficiency it acts on.
- \`time_to_effect\` — how long before a user would notice the effect the
  product claims: \`{"value": n, "unit": "hours|days|weeks|months"}\`, as a study
  or reference states it. When no source states one, set it null and
  record_gap with missing "time_to_effect: <active>: <why>".
- \`magnitude\` — the size of the effect a study found, in its own terms, or
  "no human data" when there is none.
- \`story_weight\` — \`carrier\` for the active(s) the product's own claims rest
  on, \`supporting\` for the rest. At least one is a carrier.

Prefer trials and reviews (PubMed, PMC, Cochrane), NIH and Examine over brand
pages. An active no source covers: record_gap with missing
"mechanism: <active>: <why>". File sources and gaps under node \`mechanism\`.`;

export const DOSE_TASK = `## Your task: our dose against the studied dose

For each active below with an amount and not in a blend, find the human study
the product's claim for it leans on, and \`record_dose_study\`:

- \`active\` copied word for word; \`studied_daily_dose\` per day as a number, in
  the label's unit for that active — convert mg, g and mcg yourself; a record
  in another unit is refused.
- \`studied_form\`, \`study\` (authors, year, design, n), \`human_study\`, and
  \`form_match\` — whether the studied form is ours, and why it matters.
- When only animal or lab work exists: \`human_study: false\`,
  \`studied_daily_dose: null\`.

Code computes our daily dose, the ratio and the class (at dose ≥ 0.8, partial
0.5–0.8, under dose < 0.5). Actives with no amount or in a blend are already
unassessable: record nothing for them, and if that is every active, call
\`finish\` straight away. File sources and gaps under node \`dose_vs_study\`.`;

export const CLAIMS_TASK = `## Your task: claim limits

For each market in the brief and each platform — \`meta\` and \`google_ads\` —
\`record_claim_limits\` once:

- \`market\` copied word for word from the brief; \`platform\`.
- \`permitted\` — claims this product could run there, written out as ad copy.
- \`forbidden\` — claims it must not run, written out, including any of its own
  site's claims (below) that cross the line.
- \`disclaimers\` that must appear, and the \`evidence_standard\` the regulator
  holds a health claim to.
- \`source_ids\` — the regulator's and the platform's own pages, recorded.

Read the market's regulators and the platform's policy pages, searching with
\`domains\` set to their sites. The dose classes below decide what is
substantiated: an unassessable or under-dose active supports no efficacy claim.
A pair you cannot source: record_gap with missing "claims: <market> /
<platform>: <why>". When the brief names no market, record_gap with missing
"claims: market: the brief names none" and finish. File under node
\`claim_limits\`. This is a research artifact, not legal advice.`;

export const COGS_TASK = `## Your task: prices

Record every price the product sells at with \`record_price\`: one bottle,
each bundle, and each subscription price, in each market the brief names
where the store shows it. Stage 1's price text is below; read the product page
again for the bundle table and the subscription price — tables drawn by
JavaScript need \`web_fetch\` of the page itself. Code computes days of supply,
whether a container runs out before the carrier active works, and the margin
at each price from the landed cost the operator entered. No price found:
record_gap with missing "prices: <why>". File under node \`cogs_refills\`.`;
