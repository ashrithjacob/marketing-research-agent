import { z } from "zod";

import { CONTRACT_VERSION, nodeSchema } from "./nodes.js";
import { briefSchema } from "./brief.js";
import {
  attributeSchema,
  excerptSchema,
  measurementSchema,
  sourceSchema,
} from "./evidence.js";
import { formSchema, relationSchema } from "./vocabulary.js";

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

export const activeIngredientSchema = z
  .object({
    name_as_printed: z.string(),
    name_normalised: z.string(),
    dose: z.string().default(""),
    unit: z.string().default(""),
    per: z.string().default(""),
    standardisation: z.string().default(""),
  })
  .strict();

export const competitorReferenceSchema = z
  .object({
    name: z.string(),
    form: formSchema,
    form_as_printed: z.string().default(""),
    actives: z.array(z.string()).min(1),
    source_id: z.string(),
  })
  .strict();
export type CompetitorReference = z.infer<typeof competitorReferenceSchema>;

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
    price_per_dose: z.string().default(""),
    source_id: z.string(),
    ad_source_ids: z.array(z.string()).default([]),
  })
  .strict();
export type Competitor = z.infer<typeof competitorSchema>;

export const stagePacketSchema = z
  .object({
    contract_version: z.string().default(CONTRACT_VERSION),
    stage: z.union([z.literal(1), z.literal(2)]).default(1),
    run_id: z.string().default(""),
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
