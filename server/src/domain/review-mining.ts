import { z } from "zod";

import { COMPETITOR_RELATIONS, formSchema, relationSchema } from "./vocabulary.js";

export const miningTargetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    relation: z.enum(["product", ...COMPETITOR_RELATIONS]),
    form: formSchema,
    actives: z.array(z.string()).min(1),
    url: z.string().default(""),
    brand: z.string().default(""),
    amazon_url: z.string().default(""),
    trustpilot: z.string().default(""),
    note: z.string().default(""),
  })
  .strict();
export type MiningTarget = z.infer<typeof miningTargetSchema>;

export const reviewMiningEstimateSchema = z
  .object({
    targets: z.number().int(),
    reviews_per_target: z.number().int(),
    bands: z.number().int(),
    reviews: z.number().int(),
    amazon_usd: z.number(),
    trustpilot_usd: z.number(),
    cost_usd: z.number(),
    arithmetic: z.string(),
  })
  .strict();
export type ReviewMiningEstimate = z.infer<typeof reviewMiningEstimateSchema>;

export const reviewMiningPlanSchema = z
  .object({
    source_run_id: z.string(),
    subject: miningTargetSchema,
    offered: z.array(miningTargetSchema),
    targets: z.array(miningTargetSchema),
    estimate: reviewMiningEstimateSchema,
  })
  .strict();
export type ReviewMiningPlan = z.infer<typeof reviewMiningPlanSchema>;

export const reviewMiningPlanRequestSchema = z
  .object({
    brief: z
      .object({
        product: z.string().default(""),
        url: z.string().default(""),
        market: z.string().default(""),
        notes: z.string().default(""),
      })
      .strict(),
    targets: z.array(z.string()).default([]),
  })
  .strict();
export type ReviewMiningPlanRequest = z.infer<typeof reviewMiningPlanRequestSchema>;

export interface BestsellerRank {
  rank: number;
  category: string;
}

export interface AmazonListing {
  asin: string;
  title: string;
  url: string;
  brand: string;
  marketplace: string;
  price: number | null;
  currency: string;
  stars: number | null;
  stars_breakdown: Record<string, number> | null;
  reviews_count: number | null;
  bought_past_month: string;
  bestseller_ranks: BestsellerRank[];
  amazon_choice: boolean;
  thumbnail: string;
}

/** A company's Trustpilot page header: its TrustScore and review count, read before anything is mined. */
export interface TrustpilotSummary {
  domain: string;
  url: string;
  stars: number | null;
  reviews: number | null;
  error: string;
  fetched_at: string;
}

export interface TargetListing {
  source_run_id: string;
  target_id: string;
  query: string;
  strategy: string;
  listing: AmazonListing | null;
  matches: boolean;
  mismatch: string;
  error: string;
  fetched_at: string;
  trustpilot?: TrustpilotSummary | null;
}
