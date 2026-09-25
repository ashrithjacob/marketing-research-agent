import type { Node } from "../../../domain/index.js";

export const NODE_RULES: Record<Node, string> = {
  product_data: `**product_data** — the checklist below is the floor, not the ceiling.
   Capture every one of: {attributes}. Anything you cannot find is a gap entry,
   not an omission and not a zero. A missing certificate of analysis is a gap.
   A product outside this shape has different facts that matter — a device's
   battery life, a tea's steep time, a course's lesson count — and each becomes
   an attribute with a key you name, cited like any checklist field.`,
  competitors: `**competitors** — every brand that sells the product's active ingredient,
   found anywhere on the open web: brand sites, Amazon and other marketplaces,
   retailers, comparison and "alternatives" threads. Two classes, and the split
   is a mechanical test, not your opinion:
   - **direct** — shares an active ingredient with the product **and** has the
     same form;
   - **indirect** — shares an active ingredient, **different** form (a spray, a
     gummy or a tea where the product is a capsule). Research indirect
     competitors to the same depth as direct ones: they compete for the same
     buyer.

   How to work this node, in order:
   a. The brief names a **genre**, not the champion. Run \`amazon_find_product\`
      with the genre name: the **champion product** is the listing with the
      highest \`reviewsCount\` — the market's most-bought, by Amazon's count.
      Note the top two listings, then fetch the champion's own page (the
      brand's site, not Amazon, which \`web_fetch\` cannot read) and record
      \`competitor_reference\` from it: its name, its \`form\`, and its actives
      (\`name_normalised\`: lowercase, trimmed, one accepted synonym, e.g.
      "vitamin b3" → "niacin"), citing that page, plus the ranking that chose
      it — \`reviews_count\`, and the runner-up listing's name and count. A
      runner-up that out-reviews the pick fails the packet. When the brief
      carries a url, the champion is that site's product and no ranking is
      needed. If \`amazon_find_product\` is absent or fails, gap it as
      "champion ranking unavailable: <why>" and choose from the best evidence
      the web offers.
   b. Find competitors: \`web_search\` for the active ingredient in every form
      ("<active> capsules", "<active> spray", "<active> gummies", "<active> tea",
      "best <active> <market>"), and \`amazon_find_product\` for the active if you
      have it. Then \`web_fetch\` each competitor's own product page — a search
      result is not a competitor, the page you read is.
   c. For each one, read off *its* page: form, actives, dose, price, and its
      positioning copy **verbatim** (the headline or tagline, character for
      character). \`shared_actives\` names the actives it has in common with the
      reference; \`relation\` follows from comparing its \`form\` with the
      reference's, and the validator checks it. The form vocabulary is built for
      supplements, so a product outside that world — a brush, a device, a cloth —
      is \`form: "other"\`. **When both sides are \`other\` the vocabulary cannot
      decide, so your \`relation\` stands** — and \`form_as_printed\` is the only
      record of why. Write it specifically enough that a reader can check the
      call: "manual bamboo toothbrush, boar bristles" against "electric brush
      heads, Sonicare-compatible" shows the difference; "toothbrush" on both does
      not. Never leave it empty on an \`other\`.
   d. A brand that solves the same problem with a **different** active is
      neither class: do not list it — add a gap "same problem, different active:
      <brand> (<its active>)". Whether another molecule is a substitute is a
      later stage's judgement.
   e. Ad-library entries are \`ad_library\` sources, linked from the competitor's
      \`ad_source_ids\`. **Every ad entry must carry \`first_seen\`**; ad longevity
      is the only outside performance signal that exists. An ad with no date is
      captured with \`first_seen: null\` AND recorded as a gap.

   Saturate each class **separately**: log two curves for this node, one with
   \`"class": "direct"\` and one with \`"class": "indirect"\`. Each point is a
   source that surfaced competitors, and \`new_themes\` is how many brands of
   that class it added that you had not seen. A class is done after three
   consecutive sources add no new brand of that class — one combined count lets
   a long direct list end the indirect search, which is the failure to avoid.`,
  review_mining: `**review_mining** — verbatim customer language with star rating, date, and a
   three-axis code (\`why_bought\` / \`why_stayed\` / \`why_quit\`). **You must
   capture 3-star reviews specifically** — they are the most honest text in
   commerce. Never clean up, summarise or paraphrase a quote: "I wake up at 3am
   and can't get back to sleep" is usable and "sleep maintenance issues" is not,
   and the degradation is irreversible.

   How to work this node, in order:
   a. \`amazon_find_product\` with the product name. **Choose by
      \`reviewsCount\`**, not by position — a listing with four reviews cannot
      support this node, and picking it wastes the whole budget below.
   b. \`mine_reviews\` **once**, with every chosen listing and every merchant
      domain worth a Trustpilot pull. It fetches each listing once per star band,
      1-5, all at the same time — one pull per band is the only way the star
      spread can be trusted. Do not split it across turns.
   c. \`amazon_reviews\` / \`trustpilot_reviews\` only to retry one pull that
      \`mine_reviews\` reported as failed.
   Ratings vastly outnumber written reviews in most categories, so
   \`no 3-star reviews with text\` is a common and *correct* answer. When a tool
   reports a GAP, record it and move on. **Never fill a missing 3-star band with
   4-star or 2-star reviews, and never let Trustpilot stand in for the
   marketplace floor** — Trustpilot reviews a merchant's service, Amazon reviews
   the product, and they are different evidence about different questions.

   A review can be verbatim, first-hand and still be about a *different
   product*: recycled Amazon listings keep their old reviews. If an excerpt's
   subject matter does not match the product, reject it and say so — an
   unverified purchase on a listing with very few reviews is the warning sign.`,
  category_data: `**category_data** — search volume as a trend over at least three years (a
   single point estimate is a gap), category size figures, seasonality. Numbers
   with their source, never your reading of them.`,
};
