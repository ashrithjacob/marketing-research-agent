import { z } from "zod";

export const AXES = ["why_bought", "why_stayed", "why_quit"] as const;
export type Axis = (typeof AXES)[number];
export const axisSchema = z.enum(AXES);

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
export const sourceKindSchema = z.enum(SOURCE_KINDS);

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

export const DEFAULT_REJECTED_KINDS: readonly SourceKind[] = [
  "seo_listicle",
  "review_roundup",
  "ai_generated",
] as const;

export const FORMS = [
  "capsule",
  "tablet",
  "gummy",
  "powder",
  "liquid",
  "spray",
  "tea",
  "topical",
  "other",
] as const;
export type Form = (typeof FORMS)[number];
export const formSchema = z.enum(FORMS);

/** For the champion's own customer: `direct` shares an active in the same form; `indirect_form` shares an active in another form; `indirect_active` shares none. */
export const COMPETITOR_RELATIONS = ["direct", "indirect_form", "indirect_active"] as const;
export type CompetitorRelation = (typeof COMPETITOR_RELATIONS)[number];
export const relationSchema = z.enum(COMPETITOR_RELATIONS);

export const JUDGEMENT_KINDS = [
  "source_rule",
  "weighting",
  "avatar_rule",
  "language_rule",
  "custom",
] as const;
export type JudgementKind = (typeof JUDGEMENT_KINDS)[number];
