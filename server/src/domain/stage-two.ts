import { z } from "zod";

import { formSchema, relationSchema } from "./vocabulary.js";

export const miningTargetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    relation: z.enum(["product", "direct", "indirect"]),
    form: formSchema,
    actives: z.array(z.string()).min(1),
    url: z.string().default(""),
  })
  .strict();
export type MiningTarget = z.infer<typeof miningTargetSchema>;

export const stageTwoEstimateSchema = z
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
export type StageTwoEstimate = z.infer<typeof stageTwoEstimateSchema>;

export const stageTwoPlanSchema = z
  .object({
    source_run_id: z.string(),
    subject: miningTargetSchema,
    targets: z.array(miningTargetSchema),
    estimate: stageTwoEstimateSchema,
  })
  .strict();
export type StageTwoPlan = z.infer<typeof stageTwoPlanSchema>;

export const stageTwoPlanRequestSchema = z
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
export type StageTwoPlanRequest = z.infer<typeof stageTwoPlanRequestSchema>;
