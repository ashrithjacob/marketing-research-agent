import { z } from "zod/v4";

import { AWARENESS_LEVELS, CLAIM_TYPES } from "./ads.js";

export const SOPHISTICATION_STAGES = [1, 2, 3, 4, 5] as const;
export const SOPHISTICATION_NAMES: Readonly<Record<number, string>> = { 1: "plain claim", 2: "bigger claim", 3: "mechanism", 4: "mechanism war", 5: "identity" };
export const MARKET_CONFIDENCE = ["low", "medium", "high"] as const;

/** Where a piece of market evidence came from. Ads and snapshots show escalation; the rest show what buyers already know. */
export const EVIDENCE_KINDS = ["stage_ad", "history_ad", "snapshot", "google_query", "amazon_query", "amazon_listing", "reddit", "review", "landing_page"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** The channels awareness is measured on, one per kind of evidence that can carry an awareness level. */
export const AWARENESS_CHANNELS = ["meta_ads", "landing_pages", "google_search", "amazon_search", "amazon_listings", "reddit", "reviews"] as const;
export type AwarenessChannel = (typeof AWARENESS_CHANNELS)[number];
export type AwarenessLevel = (typeof AWARENESS_LEVELS)[number];

/** One piece of evidence a tool showed the market reader, under the id it is cited by. `volume` weighs it: monthly searches for a query, number of ratings for a listing. */
export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  text: string;
  url: string | null;
  brand: string | null;
  date: string | null;
  days_running: number | null;
  active: boolean | null;
  volume: number | null;
}

/** What the market reader hands back: claims grouped from ads, the stage it reads off them, and an awareness level on each piece of buyer evidence it judged. Everything is cited by id. */
export const MarketReadSchema = z.object({
  claim_groups: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9][a-z0-9_]{1,40}$/).describe("A short lower_snake_case key, e.g. trapped_mucus."),
        claim: z.string().min(1).describe("The claim in a few words, e.g. 'dissolves trapped mucus at the source'."),
        claim_type: z.enum(CLAIM_TYPES),
        ad_ids: z.array(z.string().min(1)).min(1).describe("Ids from list_ads or search_ad_history of every ad making this claim."),
      }),
    )
    .min(1),
  sophistication: z.object({
    stage: z.number().int().min(1).max(5).describe("1 plain claim, 2 bigger claim, 3 mechanism, 4 mechanism war, 5 identity."),
    why: z.string().min(1).describe("Two or three sentences: which claims, how many brands, since when, how far they escalated."),
    claim_group_keys: z.array(z.string()).min(1).describe("The claim groups the stage rests on."),
    snapshot_ids: z.array(z.string()).describe("Page snapshots that show the escalation, if any."),
    confidence: z.enum(MARKET_CONFIDENCE),
  }),
  labels: z
    .array(z.object({ id: z.string().min(1), awareness: z.enum(AWARENESS_LEVELS) }))
    .describe("An awareness level for each query, listing, Reddit post, review or landing page you judged, by id."),
});
export type MarketRead = z.infer<typeof MarketReadSchema>;

/** One claim as code counted it from the ads behind it. */
export interface ClaimCensus {
  key: string;
  claim: string;
  claim_type: string;
  ads: number;
  brands: string[];
  first_seen: string | null;
  longest_days: number | null;
  active: number;
}

/** How one channel's evidence splits across awareness levels: shares of the items, or of their monthly searches where volumes are known. */
export interface ChannelAwareness {
  channel: AwarenessChannel;
  items: number;
  weighted_by_volume: boolean;
  shares: Partial<Record<AwarenessLevel, number>>;
}

/** Stage 4's result, every number counted by code from the reader's labels and the evidence it cited. */
export interface MarketAssessment {
  run_id: string;
  sophistication_stage: number;
  confidence: string;
  why: string;
  claims: ClaimCensus[];
  awareness: ChannelAwareness[];
  evidence: Array<EvidenceItem & { awareness: AwarenessLevel | null }>;
  snapshot_ids: string[];
}
