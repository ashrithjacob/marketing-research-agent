/**
 * The stage-1 run contract (`marketing-research-agent/spec-stage-1.md` §4).
 *
 * Every object is `.strict()`, and that is the point rather than tidiness.
 * Stage 1 is gather-only, so the schema deliberately has no field a judgement
 * could be written into — no `claim`, no `finding`, no `summary`. An agent that
 * wants to conclude something in stage 1 has nowhere to put it, which is a
 * stronger guarantee than a prompt asking it not to.
 *
 * If validation starts rejecting something legitimate, widen the schema on
 * purpose. Do not loosen the validator.
 */

import { z } from "zod";

export const CONTRACT_VERSION = "1";

export const NODES = [
  "product_data",
  "competitors",
  "review_mining",
  "category_data",
] as const;
export type Node = (typeof NODES)[number];

/**
 * Which stage each node belongs to.
 *
 * **Revised 2026-09-21: review mining is its own stage.** It was the fourth node
 * of stage 1 and it behaves like nothing else in it: the only node with paid
 * tools, the only one that can be blocked outright by a product having no
 * marketplace presence, and the one whose failures (a missing 3★ band, reviews
 * of a recycled listing) say nothing about whether the other three succeeded.
 * Bundled together, one dead review node made a whole stage-1 packet `invalid`,
 * and a product with no reviews could not produce a stage-1 packet at all.
 *
 * Splitting it means the two can fail independently, and the compartment reads
 * the way the work actually happens: describe the thing and its market, then go
 * and listen to customers.
 */
export const STAGE_NODES: Readonly<Record<Stage, readonly Node[]>> = {
  1: ["product_data", "competitors", "category_data"],
  2: ["review_mining"],
};

export const STAGES = [1, 2] as const;
export type Stage = (typeof STAGES)[number];

/** The stage a node is collected in. */
export function stageOf(node: Node): Stage {
  return STAGE_NODES[2].includes(node) ? 2 : 1;
}

/**
 * The stage a set of nodes belongs to, or null when they straddle two.
 *
 * A run covers one stage. A request naming `product_data` and `review_mining`
 * together is not a small mistake to normalise away — it is two runs.
 */
export function stageForNodes(nodes: readonly Node[]): Stage | null {
  if (nodes.length === 0) return null;
  const stages = new Set(nodes.map(stageOf));
  return stages.size === 1 ? [...stages][0]! : null;
}

export const AXES = ["why_bought", "why_stayed", "why_quit"] as const;
export type Axis = (typeof AXES)[number];

export const SOURCE_KINDS = [
  "first_party",
  "coa",
  "marketplace_review",
  "review_platform",
  "forum",
  "video_comments",
  "ad_library",
  "trial",
  "reference",
  "keyword_data",
  "competitor_marketing",
  "seo_listicle",
  "review_roundup",
  "ai_generated",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/**
 * The enum has to reach the agent, not just the validator. The first live run
 * invented `product_page`, `marketplace_page`, `industry_report` and four others
 * — reasonable names, none of them in the enum, and the whole packet was
 * rejected for it. The prompt lists these verbatim, each with the note that
 * says which one a borderline source belongs to.
 */
export const SOURCE_KIND_NOTES: ReadonlyArray<readonly [SourceKind, string]> = [
  ["first_party", "the brand's own site, label or product page"],
  ["coa", "certificate of analysis — the strongest evidence class here"],
  ["marketplace_review", "Amazon, eBay, the brand's own store reviews"],
  ["review_platform", "Trustpilot and similar"],
  ["forum", "Reddit, niche boards, Q&A sites"],
  ["video_comments", "YouTube or TikTok comments"],
  ["ad_library", "Meta/TikTok/Google ad libraries — `first_seen` required"],
  ["trial", "a study or trial; needs dose, form and population"],
  ["reference", "Examine, NIH fact sheets, secondary compendia"],
  ["keyword_data", "search volume and trend tooling; also market-size reports"],
  ["competitor_marketing", "a competitor's own site or copy"],
  ["seo_listicle", "'best X of 2026' pages — marketing dressed as review data"],
  ["review_roundup", "aggregated review articles — same"],
  ["ai_generated", "machine-written filler, where you can tell"],
] as const;

/**
 * §3. Rejected by default: marketing dressed as review data. Not code — a run's
 * admission policy overrides this, and a `source_rule` judgement writes to it.
 */
export const DEFAULT_REJECTED_KINDS: readonly SourceKind[] = [
  "seo_listicle",
  "review_roundup",
  "ai_generated",
] as const;

/** §2.1. Each is captured or gapped with a reason; a missing COA is a gap, not a zero. */
export const PRODUCT_ATTRIBUTES: readonly string[] = [
  "name",
  "brand",
  "form",
  "dose_per_serving",
  "servings_per_container",
  "full_ingredient_panel",
  "price",
  "subscription_terms",
  "claims_made_on_own_site",
  "coa_present",
] as const;

/**
 * §2.2. A product's form, from a fixed vocabulary. The direct/indirect split is
 * "same active, same form" against "same active, different form", and it only
 * stays mechanical — two people classify a pair identically — if "veg caps" and
 * "capsules" are the same word. `form_as_printed` keeps what the label said.
 */
export const FORMS = [
  "capsule", // incl. softgel, veg cap
  "tablet", // incl. chewable, effervescent
  "gummy",
  "powder",
  "liquid", // drops, tincture, syrup, shot
  "spray",
  "tea",
  "topical", // cream, balm, oil or patch on the skin
  "other",
] as const;
export type Form = (typeof FORMS)[number];

export const COMPETITOR_RELATIONS = ["direct", "indirect"] as const;
export type CompetitorRelation = (typeof COMPETITOR_RELATIONS)[number];

const nodeSchema = z.enum(NODES);
const axisSchema = z.enum(AXES);
const sourceKindSchema = z.enum(SOURCE_KINDS);
const formSchema = z.enum(FORMS);
const relationSchema = z.enum(COMPETITOR_RELATIONS);

export const briefSchema = z
  .object({
    // Empty when the brief is a store URL: naming the product is then the
    // agent's first job, and `normaliseBrief` keeps a url out of this field.
    product: z.string().default(""),
    url: z.string().default(""),
    market: z.string().default(""),
    notes: z.string().default(""),
  })
  .strict();
export type Brief = z.infer<typeof briefSchema>;

/** A bare `example.com` or a full `https://…`, with no spaces in it. */
const URL_LIKE = /^(https?:\/\/\S+|(?!.*\s)[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?)$/i;

export function looksLikeUrl(value: string): boolean {
  return URL_LIKE.test(value.trim());
}

/**
 * A url typed into the product box belongs in `url`, never in `product`.
 *
 * `product` is a name a human or the agent wrote; `url` is where to start. Left
 * mixed, the prompt printed "**Product:** https://thedropletco.co.uk/" directly
 * above "No product URL was supplied", which a real run spent a turn arguing
 * with before inventing a name — "Droplet (The Droplet Co) — luxury reed
 * diffuser home fragrance" — that then failed the brief check. Normalising here
 * means every later step (prompt, cockpit, validator) sees the two apart.
 */
export function normaliseBrief(brief: Brief): Brief {
  const product = brief.product.trim();
  if (!looksLikeUrl(product)) return { ...brief, product, url: brief.url.trim() };
  const url = brief.url.trim() || (/^https?:\/\//i.test(product) ? product : `https://${product}`);
  return { ...brief, product: "", url };
}

/**
 * Where in the source the span was taken from.
 *
 * `char_range` is the honest default for fetched text. `url` is for a review
 * the review tools returned: it has a permalink of its own and no offsets in a
 * fetched page. `selector` and `note` exist for material that has no stable
 * offsets (a PDF, a screenshot of an ad).
 */
export const locatorSchema = z
  .object({
    kind: z.enum(["char_range", "url", "selector", "note"]),
    start: z.number().int().nullable().default(null),
    end: z.number().int().nullable().default(null),
    url: z.string().default(""),
    selector: z.string().default(""),
    note: z.string().default(""),
  })
  .strict();
export type Locator = z.infer<typeof locatorSchema>;

export const sourceSchema = z
  .object({
    id: z.string(), // sha256:… over the normalised captured text
    url: z.string(),
    title: z.string().default(""),
    kind: sourceKindSchema,
    publisher: z.string().default(""),
    fetched_at: z.string().default(""),
    // ad_library only. null is a gap, not a zero: longevity is the only outside
    // performance signal there is (spec.md §7).
    first_seen: z.string().nullable().default(null),
    marketing: z.boolean().default(false),
    admitted: z.boolean().default(true),
    admission_reason: z.string().default(""),
    // False when the raw body could not be written to the corpus volume. The run
    // still completes; the source becomes a gap.
    archived: z.boolean().default(false),
    node: nodeSchema,
  })
  .strict();
export type Source = z.infer<typeof sourceSchema>;

/** A verbatim span. Immutable by construction — see `store.ts`. */
export const excerptSchema = z
  .object({
    id: z.string(),
    source_id: z.string(),
    text: z.string(),
    locator: locatorSchema.nullable().default(null),
    captured_at: z.string().default(""),
    node: nodeSchema,
    star_rating: z.number().int().min(1).max(5).nullable().default(null),
    posted_at: z.string().default(""),
    axis: axisSchema.nullable().default(null),
    // A working index over excerpts, not a finding. Labels only, no descriptions
    // (§5) — a theme with prose attached is a conclusion wearing a hat.
    themes: z.array(z.string()).default([]),
  })
  .strict();
export type Excerpt = z.infer<typeof excerptSchema>;

/** A number a source states, copied with its unit and period. */
export const measurementSchema = z
  .object({
    id: z.string(),
    node: nodeSchema,
    metric: z.string(),
    value: z.union([z.number(), z.string()]),
    unit: z.string().default(""),
    period: z.string().default(""),
    source_id: z.string(),
    locator: locatorSchema.nullable().default(null),
  })
  .strict();
export type Measurement = z.infer<typeof measurementSchema>;

/** A field lifted off a page: dose, price, format, first-seen date. */
export const attributeSchema = z
  .object({
    id: z.string(),
    node: nodeSchema,
    key: z.string(),
    value: z.string(),
    source_id: z.string(),
    locator: locatorSchema.nullable().default(null),
  })
  .strict();
export type Attribute = z.infer<typeof attributeSchema>;

export const saturationPointSchema = z
  .object({
    source_id: z.string(),
    new_themes: z.number().int(),
    cumulative_themes: z.number().int(),
  })
  .strict();

export const saturationSchema = z
  .object({
    node: nodeSchema,
    // competitors only: discovery saturates per class (§2.2), so that a long
    // direct list cannot end the indirect search. Null for every other node.
    class: relationSchema.nullable().default(null),
    curve: z.array(saturationPointSchema).default([]),
    stopped_because: z.string().default(""),
  })
  .strict();
export type Saturation = z.infer<typeof saturationSchema>;

export const nodeStatusSchema = z
  .object({
    node: nodeSchema,
    status: z.enum(["complete", "incomplete"]),
    done_criterion_met: z.boolean(),
    why: z.string().default(""),
  })
  .strict();

export const gapSchema = z
  .object({
    node: nodeSchema,
    missing: z.string(),
    would_need: z.string().default(""),
    blocking: z.boolean().default(false),
  })
  .strict();
export type Gap = z.infer<typeof gapSchema>;

/**
 * §2.1's active-ingredient entry, as read off a label. `name_normalised` is
 * lowercase, trimmed, one accepted synonym mapping — it is the join key the
 * direct/indirect test compares on.
 */
export const activeIngredientSchema = z
  .object({
    name_as_printed: z.string(),
    name_normalised: z.string(),
    dose: z.string().default(""),
    unit: z.string().default(""),
    per: z.string().default(""), // serving | capsule | ml
    standardisation: z.string().default(""), // "10:1", "95% curcuminoids"
  })
  .strict();

/**
 * The product competitors are measured against, as read off its own page.
 *
 * A competitors-only run has no product_data attributes to compare with, and
 * the direct/indirect test needs the product's form and actives — so the node
 * records them itself, with the page they came from.
 */
export const competitorReferenceSchema = z
  .object({
    name: z.string(),
    form: formSchema,
    form_as_printed: z.string().default(""),
    actives: z.array(z.string()).min(1), // name_normalised values
    source_id: z.string(),
  })
  .strict();
export type CompetitorReference = z.infer<typeof competitorReferenceSchema>;

/**
 * §2.2 / §4.3 — one competitor, the only genuinely new row shape stage 1 has.
 *
 * `relation` is not the agent's opinion: the validator recomputes it from `form`
 * against the reference's form, and `shared_actives` must appear both in this
 * row's actives and the reference's. Everything else is transcription, and
 * `positioning_copy` is verbatim.
 */
export const competitorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    brand: z.string().default(""),
    url: z.string(),
    relation: relationSchema,
    form: formSchema,
    form_as_printed: z.string().default(""),
    active_ingredients: z.array(activeIngredientSchema).min(1),
    shared_actives: z.array(z.string()).min(1),
    dose_per_serving: z.string().default(""),
    positioning_copy: z.string().default(""),
    price: z.string().default(""),
    // Only where the page states it, or it is price ÷ servings shown on the same page.
    price_per_dose: z.string().default(""),
    source_id: z.string(), // the page the row was read from
    ad_source_ids: z.array(z.string()).default([]), // its `ad_library` sources
  })
  .strict();
export type Competitor = z.infer<typeof competitorSchema>;

/** What one stage-1 run emits. Nothing here may be a judgement. */
export const stagePacketSchema = z
  .object({
    contract_version: z.string().default(CONTRACT_VERSION),
    // 1 for the product/competitors/category packet, 2 for review mining.
    stage: z.union([z.literal(1), z.literal(2)]).default(1),
    run_id: z.string().default(""), // echoed; agentchat is the authority on run ids
    brief: briefSchema,
    sources: z.array(sourceSchema).default([]),
    excerpts: z.array(excerptSchema).default([]),
    measurements: z.array(measurementSchema).default([]),
    attributes: z.array(attributeSchema).default([]),
    competitor_reference: competitorReferenceSchema.nullable().default(null),
    competitors: z.array(competitorSchema).default([]),
    saturation: z.array(saturationSchema).default([]),
    nodes: z.array(nodeStatusSchema).default([]),
    gaps: z.array(gapSchema).default([]),
  })
  .strict();
export type StagePacket = z.infer<typeof stagePacketSchema>;

// -- standing judgements (§7) ------------------------------------------------

export const JUDGEMENT_KINDS = [
  "source_rule",
  "weighting",
  "avatar_rule",
  "language_rule",
  "custom",
] as const;
export type JudgementKind = (typeof JUDGEMENT_KINDS)[number];

export const judgementInSchema = z
  .object({
    kind: z.enum(JUDGEMENT_KINDS).default("custom"),
    text: z.string(),
    // `source_rule` only: kinds this rule rejects. Mutating the admission policy
    // is what makes the rule mechanical rather than a matter of the model
    // remembering it.
    rejects_kinds: z.array(sourceKindSchema).default([]),
  })
  .strict();
export type JudgementIn = z.infer<typeof judgementInSchema>;

export const runRequestSchema = z
  .object({
    brief: briefSchema,
    model: z.string().default(""),
    // Overrides DEFAULT_REJECTED_KINDS when set (empty means "use the default").
    reject_kinds: z.array(sourceKindSchema).default([]),
    // The nodes this run researches. Empty means the whole stage.
    nodes: z.array(nodeSchema).default([]),
  })
  .strict();
export type RunRequest = z.infer<typeof runRequestSchema>;

/**
 * Two briefs name the same subject when their product or their site matches.
 *
 * Used to find the stage-1 run that a stage-2 run is allowed to follow, so it is
 * deliberately forgiving about case and spacing and strict about nothing else:
 * the alternative is an operator who cannot start review mining because they
 * typed the product name slightly differently the second time.
 */
export function briefKey(brief: { product?: unknown; url?: unknown }): string {
  const url = typeof brief.url === "string" ? brief.url.trim() : "";
  if (url) {
    try {
      const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`);
      return `site:${parsed.hostname.replace(/^www\./, "").toLowerCase()}`;
    } catch {
      return `site:${url.toLowerCase()}`;
    }
  }
  const product = typeof brief.product === "string" ? brief.product : "";
  return `product:${product.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

/**
 * The nodes a run covers, in stage order and without repeats. Empty — the
 * default, and what every run before per-node runs stored — means all of them.
 */
export function runNodes(nodes: readonly string[] | undefined): Node[] {
  const wanted = new Set(nodes ?? []);
  const scoped = NODES.filter((n) => wanted.has(n));
  // Empty means the whole of stage 1 — the default a bare "Start run" sends,
  // and what every run stored before review mining moved to stage 2 was.
  return scoped.length > 0 ? scoped : [...STAGE_NODES[1]];
}

/** True when a run covers only part of its stage. */
export function isPartial(nodes: readonly Node[]): boolean {
  const stage = stageForNodes(nodes);
  if (stage === null) return true;
  return nodes.length < STAGE_NODES[stage].length;
}
