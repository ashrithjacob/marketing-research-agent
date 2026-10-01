import { z } from "zod";

export const TIME_UNITS = ["hours", "days", "weeks", "months"] as const;
export const DAYS_PER_UNIT: Readonly<Record<(typeof TIME_UNITS)[number], number>> = { hours: 1 / 24, days: 1, weeks: 7, months: 30 };
export const STORY_WEIGHTS = ["carrier", "supporting"] as const;
export const AD_PLATFORMS = ["meta", "google_ads"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

export const activeSchema = z
  .object({
    name: z.string().min(1),
    amount: z.number().positive().nullable(),
    unit: z.string().default(""),
    form: z.string().default(""),
    in_blend: z.boolean(),
    source_id: z.string(),
  })
  .strict();
export type Active = z.infer<typeof activeSchema>;

export const regimenSchema = z
  .object({
    servings_per_day: z.number().positive().nullable(),
    servings_per_container: z.number().positive().nullable(),
    directions_as_printed: z.string().default(""),
    source_id: z.string(),
  })
  .strict();
export type Regimen = z.infer<typeof regimenSchema>;

export const timeToEffectSchema = z.object({ value: z.number().positive(), unit: z.enum(TIME_UNITS) }).strict();

export const mechanismSchema = z
  .object({
    active: z.string().min(1),
    pathway: z.string().min(1),
    time_to_effect: timeToEffectSchema.nullable(),
    magnitude: z.string().min(1),
    story_weight: z.enum(STORY_WEIGHTS),
    source_id: z.string(),
  })
  .strict();
export type Mechanism = z.infer<typeof mechanismSchema>;

export const doseStudySchema = z
  .object({
    active: z.string().min(1),
    studied_daily_dose: z.number().positive().nullable(),
    unit: z.string().default(""),
    studied_form: z.string().default(""),
    study: z.string().min(1),
    human_study: z.boolean(),
    form_match: z.string().min(1),
    source_id: z.string(),
  })
  .strict();
export type DoseStudy = z.infer<typeof doseStudySchema>;

export const claimLimitSchema = z
  .object({
    market: z.string().min(1),
    platform: z.enum(AD_PLATFORMS),
    permitted: z.array(z.string().min(1)).min(1),
    forbidden: z.array(z.string().min(1)).min(1),
    disclaimers: z.array(z.string()).default([]),
    evidence_standard: z.string().min(1),
    source_ids: z.array(z.string()).min(1),
  })
  .strict();
export type ClaimLimit = z.infer<typeof claimLimitSchema>;

export const pricePointSchema = z
  .object({
    label: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/, "an ISO currency code such as USD"),
    units: z.number().int().positive(),
    subscription: z.boolean().default(false),
    market: z.string().default(""),
    source_id: z.string(),
  })
  .strict();
export type PricePoint = z.infer<typeof pricePointSchema>;

export const operatorInputSchema = z
  .object({
    landed_unit_cost: z.number().positive().nullable().default(null),
    currency: z.string().default(""),
    moq: z.number().int().positive().nullable().default(null),
    lead_time_days: z.number().int().positive().nullable().default(null),
  })
  .strict();
export type OperatorInput = z.infer<typeof operatorInputSchema>;

export const operatorPriceSchema = pricePointSchema.omit({ source_id: true, market: true });

/** What the operator types when starting product truth: costs the agents never estimate, and prices to add to the ones stage 1 found. */
export const productTruthInputsSchema = operatorInputSchema.extend({ prices: z.array(operatorPriceSchema).default([]) }).strict();
export type ProductTruthInputs = z.infer<typeof productTruthInputsSchema>;
