/**
 * Build the stage-1 instructions handed to the agent.
 *
 * The prompt has one job the validator cannot do for it: get the agent to gather
 * rather than conclude. The validator can only reject a packet that has already
 * been written, so the prompt states the rule and the schema removes the place to
 * break it. Both, or the failure mode is a run that costs money and fails at the
 * last step.
 *
 * Kept in one module because the exact wording is a thing you tune against real
 * runs, and it should be diffable on its own.
 *
 * **Superseded:** under hermes the agent was told to archive each fetched body
 * itself, with the terminal tool, to `<corpus>/runs/<run_id>/sources/<sha256>`.
 * That put a mechanical step on the model's to-do list, and a model that forgets
 * it produces a packet claiming `archived: true` over a file that does not
 * exist — an audit trail that lies. `web_fetch` now archives and hashes the body
 * before the agent ever sees it, and hands back the id to cite. The prompt tells
 * the agent to *use* that id rather than to compute one.
 */

import {
  DEFAULT_REJECTED_KINDS,
  FORMS,
  NODES,
  PRODUCT_ATTRIBUTES,
  SOURCE_KIND_NOTES,
  isPartial,
  type Brief,
  type Node,
  type SourceKind,
} from "./schema.js";
import type { Judgement } from "./store.js";

/**
 * A worked miniature. Models follow an example far more reliably than a prose
 * description of a schema, and a wrong-shaped packet costs a whole run.
 */
const EXAMPLE = {
  contract_version: "1",
  stage: 1,
  brief: { product: "MagnaCalm glycinate 400mg", url: "https://…", market: "UK" },
  sources: [
    {
      id: "sha256:2f1a…",
      url: "https://reddit.com/r/insomnia/comments/9d1x",
      title: "Anyone else waking at 3am?",
      kind: "forum",
      publisher: "reddit.com",
      fetched_at: "2026-09-10T09:14:22Z",
      marketing: false,
      admitted: true,
      admission_reason: "forum — admitted by policy",
      archived: true,
      node: "review_mining",
    },
    {
      id: "sha256:7d5b…",
      url: "https://amazon.co.uk/product-reviews/B0C?filter=3star",
      title: "MagnaCalm reviews, 3 star",
      kind: "marketplace_review",
      publisher: "amazon.co.uk",
      fetched_at: "2026-09-10T09:20:11Z",
      marketing: false,
      admitted: true,
      admission_reason: "marketplace_review — admitted by policy",
      archived: true,
      node: "review_mining",
    },
    {
      id: "sha256:9c04…",
      url: "https://top10supplementpicks.net/best-magnesium",
      title: "Best magnesium 2026",
      kind: "seo_listicle",
      publisher: "top10supplementpicks.net",
      fetched_at: "2026-09-10T09:15:02Z",
      marketing: true,
      admitted: false,
      admission_reason: "seo_listicle — rejected by admission policy",
      archived: false,
      node: "competitors",
    },
    {
      id: "sha256:1c9d…",
      url: "https://magnacalm.example/products/glycinate-400",
      title: "MagnaCalm Magnesium Glycinate 400mg — 90 capsules",
      kind: "first_party",
      publisher: "magnacalm.example",
      fetched_at: "2026-09-10T09:11:40Z",
      marketing: true,
      admitted: true,
      admission_reason: "first_party — the product's own page",
      archived: true,
      node: "competitors",
    },
    {
      id: "sha256:5e21…",
      url: "https://calmwell.example/magnesium-glycinate",
      title: "CalmWell Magnesium Glycinate 400mg",
      kind: "competitor_marketing",
      publisher: "calmwell.example",
      fetched_at: "2026-09-10T09:16:05Z",
      marketing: true,
      admitted: true,
      admission_reason: "competitor_marketing — admitted by policy",
      archived: true,
      node: "competitors",
    },
    {
      id: "sha256:a803…",
      url: "https://sleepmist.example/magnesium-spray",
      title: "SleepMist Magnesium Glycinate Oral Spray",
      kind: "competitor_marketing",
      publisher: "sleepmist.example",
      fetched_at: "2026-09-10T09:17:30Z",
      marketing: true,
      admitted: true,
      admission_reason: "competitor_marketing — admitted by policy",
      archived: true,
      node: "competitors",
    },
    {
      id: "sha256:d4f7…",
      url: "https://www.facebook.com/ads/library/?id=1234567890",
      title: "CalmWell — 'Finally sleeping through' ad",
      kind: "ad_library",
      publisher: "facebook.com",
      fetched_at: "2026-09-10T09:18:44Z",
      first_seen: "2026-03-02",
      marketing: true,
      admitted: true,
      admission_reason: "ad_library — admitted by policy",
      archived: true,
      node: "competitors",
    },
  ],
  excerpts: [
    {
      id: "sha256:4b7e…",
      source_id: "sha256:2f1a…",
      text: "I wake up at 3am and can't get back to sleep. Every single night.",
      locator: { kind: "char_range", start: 4120, end: 4187 },
      captured_at: "2026-09-10T09:14:25Z",
      node: "review_mining",
      star_rating: null,
      posted_at: "2026-04-02",
      axis: "why_bought",
      themes: ["3am waking"],
    },
    {
      id: "sha256:e10c…",
      source_id: "sha256:7d5b…",
      text: "Took it for a week, felt nothing, cancelled. Turns out you need six weeks.",
      locator: { kind: "char_range", start: 812, end: 886 },
      captured_at: "2026-09-10T09:20:14Z",
      node: "review_mining",
      star_rating: 3,
      posted_at: "2026-05-19",
      axis: "why_quit",
      themes: ["time to effect"],
    },
  ],
  measurements: [
    {
      id: "m1",
      node: "category_data",
      metric: "search_volume",
      value: 1900000,
      unit: "searches/month",
      period: "2026-08",
      source_id: "sha256:2f1a…",
    },
  ],
  attributes: [
    {
      id: "a1",
      node: "product_data",
      key: "dose_per_serving",
      value: "400 mg",
      source_id: "sha256:2f1a…",
    },
  ],
  competitor_reference: {
    name: "MagnaCalm Magnesium Glycinate 400mg",
    form: "capsule",
    form_as_printed: "90 vegan capsules",
    actives: ["magnesium glycinate"],
    source_id: "sha256:1c9d…",
  },
  competitors: [
    {
      id: "c1",
      name: "CalmWell Magnesium Glycinate 400mg",
      brand: "CalmWell",
      url: "https://calmwell.example/magnesium-glycinate",
      relation: "direct",
      form: "capsule",
      form_as_printed: "120 capsules",
      active_ingredients: [
        {
          name_as_printed: "Magnesium (as Magnesium Bisglycinate)",
          name_normalised: "magnesium glycinate",
          dose: "400",
          unit: "mg",
          per: "serving",
          standardisation: "",
        },
      ],
      shared_actives: ["magnesium glycinate"],
      dose_per_serving: "400 mg (2 capsules)",
      positioning_copy: "The gentle magnesium that lets you sleep through the night.",
      price: "£19.99",
      price_per_dose: "£0.33 per serving",
      source_id: "sha256:5e21…",
      ad_source_ids: ["sha256:d4f7…"],
    },
    {
      id: "c2",
      name: "SleepMist Magnesium Glycinate Oral Spray",
      brand: "SleepMist",
      url: "https://sleepmist.example/magnesium-spray",
      relation: "indirect",
      form: "spray",
      form_as_printed: "oral spray, 50 ml",
      active_ingredients: [
        {
          name_as_printed: "Magnesium Glycinate",
          name_normalised: "magnesium glycinate",
          dose: "100",
          unit: "mg",
          per: "serving",
          standardisation: "",
        },
      ],
      shared_actives: ["magnesium glycinate"],
      dose_per_serving: "100 mg (4 sprays)",
      positioning_copy: "Four sprays under the tongue. No pills to swallow.",
      price: "£14.00",
      price_per_dose: "",
      source_id: "sha256:a803…",
      ad_source_ids: [],
    },
  ],
  saturation: [
    {
      node: "review_mining",
      curve: [
        { source_id: "sha256:2f1a…", new_themes: 4, cumulative_themes: 4 },
        { source_id: "sha256:7d5b…", new_themes: 0, cumulative_themes: 11 },
      ],
      stopped_because: "three consecutive sources added no new theme",
    },
    {
      node: "competitors",
      class: "direct",
      curve: [
        { source_id: "sha256:5e21…", new_themes: 1, cumulative_themes: 1 },
        { source_id: "sha256:9c04…", new_themes: 0, cumulative_themes: 1 },
      ],
      stopped_because: "still finding direct brands when the example ends",
    },
    {
      node: "competitors",
      class: "indirect",
      curve: [{ source_id: "sha256:a803…", new_themes: 1, cumulative_themes: 1 }],
      stopped_because: "still finding indirect brands when the example ends",
    },
  ],
  nodes: [
    {
      node: "review_mining",
      status: "complete",
      done_criterion_met: true,
      why: "saturated at 14 sources; 3-star coverage present",
    },
    {
      node: "competitors",
      status: "incomplete",
      done_criterion_met: false,
      why: "neither class had three consecutive sources with no new brand",
    },
  ],
  gaps: [
    {
      node: "competitors",
      missing: "CalmWell ad library returns no UK creative",
      would_need: "a UK-IP ad-library pull, or a manual capture",
      blocking: false,
    },
  ],
};

const SYSTEM_PROMPT = `You are the stage-1 researcher of a five-stage marketing research \
compartment. You gather raw material from the open web and record it verbatim. You do not \
interpret it, and the output schema has no field an interpretation could be written into.

You have these tools:

- \`web_search\` — search the web and get back titles, urls and snippets. Snippets are a \
way of choosing what to fetch, never a source in their own right: never quote one, and \
never cite a url you have only seen in search results.
- \`web_fetch\` — fetch one url and get back its readable text. Every fetch is archived and \
hashed before you see it, and the result carries the \`source_id\` to cite. Use that id \
exactly as given.
- \`amazon_find_product\` — search Amazon by product name for asin, title, stars and \
\`reviewsCount\`. Amazon is unreadable to \`web_fetch\` from this server, so this and the \
next tool are the only route to marketplace reviews.
- \`amazon_reviews\` — verbatim reviews for ONE Amazon product url, optionally at one star \
band. Archived and hashed like \`web_fetch\`.
- \`trustpilot_reviews\` — verbatim reviews for ONE company domain. These review the \
**merchant**, not the product.

The last three may be absent. If they are, marketplace reviews cannot be reached at all \
and \`review_mining\` is incomplete with a gap saying so — do not substitute blog roundups.

Work through the four nodes methodically. Fetch before you write anything down.`;

const RULES = `\
## Stage 1 — raw material. Gather only.

You are running stage 1 of a five-stage marketing research compartment. Stage 1
collects material. It does not interpret it. Concluding while collecting is the
single most common failure in this framework, and the output schema has no field
a conclusion could be written into — if you find yourself wanting to write down
what the material *means*, that belongs to a later stage and there is nowhere to
put it here.

Three things are not conclusions and are what you are here for:

- **excerpts** — text copied verbatim from a source, character for character
- **measurements** — a number a source states, with its unit and period
- **attributes** — a field read off a page (dose, price, format, first-seen date)

The test: if a second person reading the same source would write down a
different value, it is a judgement and does not belong in stage 1.

{nodes}

### Done is saturation, not a quota

A node is done when three consecutive admitted sources produce **no new theme**.
Do not aim for a number of sources or quotes: a quota you cannot honestly fill
is the thing that makes inventing citations the path of least resistance. Log
the curve — \`new_themes\` per source — so "it stopped yielding" is a number.

A **theme** is a short label over excerpts. It is a working index for measuring
saturation, not a finding. Give it a label and nothing else.

### Admission

Fetch what you like, but record every source you touched with \`admitted\` and
\`admission_reason\`. **Rejected sources stay in the packet** — they are evidence
of what was searched.

\`kind\` must be **exactly one of** these. There are no others, and inventing one
fails the whole packet — pick the closest:

{kinds}

These kinds are rejected by this run's policy:

{rejected}

Anything promotional gets \`marketing: true\`, including a brand's own site. That
is not a rejection; it marks a claim resting only on marketing as weaker than
one resting on a certificate of analysis.

### How to fetch, and what a source id is

\`web_search\` finds candidates; \`web_fetch\` is the only thing that makes one a
source. A search snippet is not material — never quote one, and never record a
source you did not fetch.

Every \`web_fetch\` archives the body it retrieved and returns a \`source_id\` of
the form \`sha256:<hash>\`. **Use that id verbatim** as the source's \`id\`, and set
\`archived: true\`. Do not invent, shorten or recompute a hash: the id is what
lets a span be checked against the archived body later, and one you made up
points at nothing.

If a fetch fails, or comes back with the body unarchived (the result says so),
record the source with \`archived: false\` and add a gap entry saying what could
not be retrieved — then carry on. The run is not blocked by it.

### The gap list is a required output

What you could not find, per node, and what it would take to get it. A run that
reports no gaps is treated as failed, because real research always has holes and
an agent that cannot say "I could not find this" will invent it instead.

{gap_nodes}
`;

/**
 * What each node asks for, in stage order. A run is given only the nodes it
 * covers, so a single-node run is not also told how to do the other three.
 */
const NODE_RULES: Record<Node, string> = {
  product_data: `**product_data** — a finite checklist, not a search. Capture every one of:
   {attributes}. Anything you cannot find is a gap entry, not an omission and
   not a zero. A missing certificate of analysis is a gap.`,
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
   a. Fetch the product's own page and record \`competitor_reference\`: its name,
      its \`form\`, and its actives (\`name_normalised\`: lowercase, trimmed, one
      accepted synonym, e.g. "vitamin b3" → "niacin"), citing that page.
   b. Find competitors: \`web_search\` for the active ingredient in every form
      ("<active> capsules", "<active> spray", "<active> gummies", "<active> tea",
      "best <active> <market>"), and \`amazon_find_product\` for the active if you
      have it. Then \`web_fetch\` each competitor's own product page — a search
      result is not a competitor, the page you read is.
   c. For each one, read off *its* page: form, actives, dose, price, and its
      positioning copy **verbatim** (the headline or tagline, character for
      character). \`shared_actives\` names the actives it has in common with the
      reference; \`relation\` follows from comparing its \`form\` with the
      reference's, and the validator checks it.
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
   b. \`amazon_reviews\` on that url, **once per star band**, \`star: 3\` first.
      One call per band is the only way the star spread can be trusted.
   c. \`trustpilot_reviews\` on the brand's domain for merchant-side language.
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

const code = (names: readonly string[]) => names.map((n) => `\`${n}\``).join(", ");

function nodesBlock(nodes: readonly Node[]): string {
  const heading = isPartial(nodes)
    ? `### This run's ${nodes.length === 1 ? "node" : "nodes"}`
    : "### The four nodes";
  const items = nodes.map((node, i) => `${i + 1}. ${NODE_RULES[node]}`);
  return [heading, "", ...items].join("\n");
}

/** Where a run-level problem goes, and which node names the packet may use. */
function gapNodesBlock(nodes: readonly Node[]): string {
  if (!isPartial(nodes)) {
    return `A run-level problem that is not one of the four nodes — a tool failing, a fetch
path blocked, a site refusing to serve — still goes in this list. Attach it to
the node it blocked; if it blocked nothing in particular, use
\`node: "category_data"\`. Never invent a fifth node name (\`all\`, \`general\`,
\`run\`): only \`product_data\`, \`competitors\`, \`review_mining\`, \`category_data\`
are accepted, and anything else fails the whole packet.`;
  }
  return `A run-level problem — a tool failing, a fetch path blocked, a site refusing
to serve — still goes in this list, attached to \`node: "${nodes[0]}"\`. Use no
node name outside this run's scope, and never invent one (\`all\`, \`general\`,
\`run\`): only ${code(nodes)} ${nodes.length === 1 ? "is" : "are"} accepted, and
anything else fails the whole packet.`;
}

/**
 * Said once, near the top, for a run that covers part of the stage. Without it
 * the worked example — which shows every node — is an invitation to fill all four.
 */
function scopeBlock(nodes: readonly Node[]): string {
  return [
    "## Scope of this run",
    "",
    `This run researches **only** ${code(nodes)}. The rest of stage 1 is out of`,
    "scope: do not search for it, and record nothing against it. Every `node` field",
    "in the packet — on sources, excerpts, measurements, attributes, saturation,",
    `nodes and gaps — must be one of ${code(nodes)}, and \`nodes\` has one entry for`,
    `each of them. Anything recorded against another node fails the whole packet.`,
  ].join("\n");
}

const OUTPUT = `\
## Output

End your reply with exactly one fenced JSON block containing the stage-1 packet.
Everything outside the fence is ignored. The block must match this shape exactly
— **any key not in this schema is rejected and the run fails**:

\`\`\`json
{example}
\`\`\`

The example shows the **shape only** — its product, market and every value in
it are invented. Your brief is the one in \`## The brief\` above: your packet's
\`brief\` echoes it, and a packet about the example's product is rejected.

Field notes:

- \`star_rating\` and \`axis\` apply to review excerpts only; use \`null\` elsewhere.
  \`posted_at\` is a string: a date like "2026-05-18" when the source shows one,
  or "" when it does not. Never \`null\` — \`null\` fails validation.
- \`locator\` is optional but strongly preferred: \`{"kind": "char_range",
  "start": N, "end": N}\` so a span can be checked against the archived body.
  A review from \`amazon_reviews\` or \`trustpilot_reviews\` has no offsets: copy
  the \`locator\` the tool printed under it, exactly as printed, e.g.
  \`{"kind": "url", "url": "https://…"}\`.
- \`nodes\` must contain an entry for {nodes_note}, \`complete\` or
  \`incomplete\`, with \`why\` naming the criterion that was or was not met.
- \`gaps\` must not be empty.
- \`competitor_reference\` and \`competitors\` belong to the competitors node; leave
  them \`null\` and \`[]\` when it is not being researched. \`form\` is exactly one
  of {forms}. \`relation\` is checked against the forms and must agree with them.
- \`saturation\` for competitors has two entries, \`"class": "direct"\` and
  \`"class": "indirect"\`; every other node's entry has no \`class\`.
`;

/**
 * The system prompt for a stage-1 run. The brief goes in the turn; only the
 * scope sentence varies, so a single-node run is not told to work four.
 */
export function systemPrompt(nodes: readonly Node[] = NODES): string {
  if (!isPartial(nodes)) return SYSTEM_PROMPT;
  let text = SYSTEM_PROMPT.replace(
    "Work through the four nodes methodically.",
    `This run covers only ${code(nodes)} — work through ${
      nodes.length === 1 ? "it" : "them"
    } methodically and leave the rest of stage 1 alone.`,
  );
  // Describe only the tools this run is offered (`createResearchTools`). A run
  // told about review tools it does not have records their absence as a gap —
  // measured on the first competitors-only run.
  if (!nodes.includes("review_mining")) {
    const [findStart, findEnd] = [text.indexOf("- `amazon_find_product`"), text.indexOf("\n\nWork through")];
    const thisRun = text.indexOf("\n\nThis run covers only");
    const end = findEnd === -1 ? thisRun : findEnd;
    const tools = nodes.includes("competitors")
      ? "- `amazon_find_product` — search Amazon (amazon.com) by product name for asin, " +
        "title, stars and `reviewsCount`: a way to find competitors, and to see which " +
        "sell. It may be absent."
      : "";
    text = text.slice(0, findStart).replace(/\n+$/, "") + (tools ? `\n${tools}` : "") + text.slice(end);
  }
  return text;
}

/**
 * Assemble the whole user turn for one stage-1 run.
 *
 * Takes no run id and no corpus path: both were only ever needed to tell the
 * agent where to write archives itself, and `web_fetch` does that now.
 */
export function buildInstructions(options: {
  brief: Brief;
  rejectKinds: readonly string[];
  judgements: readonly Judgement[];
  /** The nodes this run covers. Omitted means the whole stage. */
  nodes?: readonly Node[];
}): string {
  const { brief, rejectKinds, judgements } = options;
  const nodes = options.nodes ?? NODES;
  const rejected = rejectKinds.length > 0 ? rejectKinds : DEFAULT_REJECTED_KINDS;
  const parts = [
    // `{nodes}` first: the product_data rule carries its own `{attributes}`.
    RULES.replace("{nodes}", nodesBlock(nodes))
      .replace("{attributes}", PRODUCT_ATTRIBUTES.map((a) => `\`${a}\``).join(", "))
      .replace("{kinds}", SOURCE_KIND_NOTES.map(([kind, note]) => `- \`${kind}\` — ${note}`).join("\n"))
      .replace("{rejected}", rejected.map((kind) => `- \`${kind}\``).join("\n") || "- (none)")
      .replace("{gap_nodes}", gapNodesBlock(nodes)),
  ];
  if (isPartial(nodes)) parts.push(scopeBlock(nodes));
  if (judgements.length > 0) parts.push(judgementBlock(judgements));
  parts.push(briefBlock(brief));
  let output = OUTPUT.replace("{example}", JSON.stringify(EXAMPLE, null, 2))
    .replace(
      "{nodes_note}",
      isPartial(nodes) ? `each node in scope (${code(nodes)})` : "each of the four nodes",
    )
    .replace("{forms}", code(FORMS));
  if (isPartial(nodes)) {
    output += `\nThe example shows every node, for shape only. Your packet records only ${code(nodes)}.\n`;
  }
  parts.push(output);
  return parts.join("\n\n");
}

/**
 * Standing corrections. These outrank the defaults above.
 *
 * A `source_rule` is also applied mechanically through the admission policy —
 * this block exists so the agent knows *why* a kind is rejected, not so it has
 * to remember to do it.
 */
function judgementBlock(judgements: readonly Judgement[]): string {
  const lines = [
    "## Standing judgements",
    "",
    "Corrections a human has given on previous runs. They apply to this run " +
      "and outrank the defaults above. You should not need telling twice.",
    "",
  ];
  for (const j of judgements) lines.push(`- **${j.kind}** — ${j.text}`);
  return lines.join("\n");
}

function briefBlock(brief: Brief): string {
  const lines = ["## The brief", "", `**Product:** ${brief.product}`];
  if (brief.url) {
    lines.push(`**Product URL:** ${brief.url}`);
  } else {
    // The normal case: the operator names a product and a market, and the
    // agent finds everything. Saying so matters — without the line, a
    // careful agent stalls asking for a URL it was never going to get.
    lines.push(
      "No product URL was supplied — finding it is part of the job. Use " +
        "web search to locate the product's own site first, then the " +
        "reviews, competitors, ad-library entries and category data the " +
        "four nodes need.",
    );
  }
  if (brief.market) lines.push(`**Market:** ${brief.market}`);
  if (brief.notes) lines.push(`**Notes:** ${brief.notes}`);
  return lines.join("\n");
}

/**
 * One correction, injected mid-run.
 *
 * Phrased as a rule rather than a request: the agent is mid-task and a polite
 * suggestion competes with the instructions it already has.
 */
export function steerText(judgement: Judgement): string {
  let rejects = "";
  if (judgement.rejects_kinds.length > 0) {
    const kinds = judgement.rejects_kinds.map((k: SourceKind) => `\`${k}\``).join(", ");
    rejects =
      ` From now on, treat sources of kind ${kinds} as rejected: still ` +
      "record them in the packet with `admitted: false` and this reason.";
  }
  return (
    "Standing judgement from the human supervising this run — apply it for " +
    `the rest of the run: ${judgement.text}${rejects}`
  );
}

/**
 * The one follow-up a run gets when it ends without a packet.
 *
 * A model deep into a long context can announce "let me write the JSON now"
 * dozens of times and then end its turn without writing it (a DeepSeek run at
 * 208k input tokens did exactly that). The research is in the transcript
 * already; one direct ask is far cheaper than rerunning it.
 */
export function packetNudgeText(): string {
  return (
    "Your last reply ended without the stage-1 packet, so this run has no " +
    "result yet. Do not research further; tools are switched off. Write the " +
    "packet now from what you have already gathered, as a single fenced " +
    "```json block, and record what you did not reach as gaps."
  );
}
