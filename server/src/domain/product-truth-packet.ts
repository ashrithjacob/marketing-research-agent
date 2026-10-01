import { z } from "zod";

import { briefSchema } from "./brief.js";
import { sourceSchema } from "./evidence.js";
import { CONTRACT_VERSION } from "./nodes.js";
import { gapSchema, nodeStatusSchema } from "./packet.js";
import {
  activeSchema,
  claimLimitSchema,
  mechanismSchema,
  operatorInputSchema,
  pricePointSchema,
  regimenSchema,
} from "./product-truth-rows.js";

export const DOSE_CLASSES = ["at_dose", "partial", "under_dose", "unassessable"] as const;
export type DoseClass = (typeof DOSE_CLASSES)[number];

/** Our daily dose over the studied daily dose: at or above `at_dose` is at dose, at or above `partial` is partial, below it under dose. */
export const DOSE_BANDS = { at_dose: 0.8, partial: 0.5 } as const;

export const RESEARCH_GUARD =
  "A research artifact, not legal advice; high-risk categories warrant counsel review before spend.";

export const doseAssessmentSchema = z
  .object({
    active: z.string(),
    our_daily_dose: z.number().nullable(),
    studied_daily_dose: z.number().nullable(),
    unit: z.string(),
    ratio: z.number().nullable(),
    class: z.enum(DOSE_CLASSES),
    why: z.string(),
    studied_form: z.string(),
    form_match: z.string(),
    study: z.string(),
    source_id: z.string(),
  })
  .strict();
export type DoseAssessment = z.infer<typeof doseAssessmentSchema>;

export const carrierTimingSchema = z
  .object({
    active: z.string(),
    time_to_effect_days: z.number().nullable(),
    runs_out_first: z.boolean().nullable(),
  })
  .strict();

export const churnSchema = z
  .object({
    mismatch: z.boolean().nullable(),
    why: z.string(),
    carriers: z.array(carrierTimingSchema),
  })
  .strict();
export type Churn = z.infer<typeof churnSchema>;

export const marginSchema = z
  .object({
    label: z.string(),
    subscription: z.boolean(),
    unit_price: z.number(),
    currency: z.string(),
    margin: z.number().nullable(),
    why: z.string(),
    source_id: z.string(),
  })
  .strict();
export type Margin = z.infer<typeof marginSchema>;

export const economicsSchema = z
  .object({
    operator: operatorInputSchema.nullable(),
    days_of_supply: z.number().nullable(),
    days_why: z.string(),
    churn: churnSchema,
    margins: z.array(marginSchema),
  })
  .strict();
export type Economics = z.infer<typeof economicsSchema>;

export const productTruthPacketSchema = z
  .object({
    contract_version: z.string().default(CONTRACT_VERSION),
    stage: z.literal(2),
    run_id: z.string(),
    source_run_id: z.string(),
    brief: briefSchema,
    guard: z.string(),
    sources: z.array(sourceSchema),
    actives: z.array(activeSchema),
    regimen: regimenSchema.nullable(),
    mechanisms: z.array(mechanismSchema),
    doses: z.array(doseAssessmentSchema),
    claim_limits: z.array(claimLimitSchema),
    prices: z.array(pricePointSchema),
    economics: economicsSchema,
    nodes: z.array(nodeStatusSchema),
    gaps: z.array(gapSchema),
  })
  .strict();
export type ProductTruthPacket = z.infer<typeof productTruthPacketSchema>;
