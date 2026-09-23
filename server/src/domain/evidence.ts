import { z } from "zod";

import { nodeSchema } from "./nodes.js";
import { axisSchema, sourceKindSchema } from "./vocabulary.js";

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
    id: z.string(),
    url: z.string(),
    title: z.string().default(""),
    kind: sourceKindSchema,
    publisher: z.string().default(""),
    fetched_at: z.string().default(""),
    first_seen: z.string().nullable().default(null),
    marketing: z.boolean().default(false),
    admitted: z.boolean().default(true),
    admission_reason: z.string().default(""),
    archived: z.boolean().default(false),
    node: nodeSchema,
  })
  .strict();
export type Source = z.infer<typeof sourceSchema>;

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
    themes: z.array(z.string()).default([]),
  })
  .strict();
export type Excerpt = z.infer<typeof excerptSchema>;

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
