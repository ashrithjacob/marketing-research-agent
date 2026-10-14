import { z } from "zod";

import { briefSchema } from "./brief.js";
import type { Deliverable } from "./deliverable.js";
import { FINDING_KINDS } from "./finding-kinds.js";
import { nodeSchema } from "./nodes.js";

export const PRIMITIVE_NAMES = ["research"] as const;
export type PrimitiveName = (typeof PRIMITIVE_NAMES)[number];

export const VERIFIERS = ["code", "critique", "owner"] as const;

const findingKind = z.enum(FINDING_KINDS);

const fieldRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("distinct_periods"), min: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("number_on_latest") }).strict(),
]);

const fieldSpecSchema = z
  .object({
    key: z.string().min(1),
    record: findingKind,
    required: z.boolean(),
    describe: z.string().min(1),
    how: z.string().optional(),
    rule: fieldRuleSchema.optional(),
  })
  .strict();

const itemPartSchema = z.object({ key: z.string().min(1), required: z.boolean(), describe: z.string().min(1) }).strict();

const itemNeedSchema = z
  .object({ key: z.string().min(1), record: findingKind, match: z.array(z.string()), field: z.string().optional(), describe: z.string().min(1) })
  .strict();

const itemSourceSchema = z.discriminatedUnion("from", [
  z
    .object({
      from: z.literal("ledger"),
      kind: findingKind,
      by: z.string().min(1),
      only: z.object({ present: z.string(), absent: z.string() }).strict().optional(),
    })
    .strict(),
  z.object({ from: z.literal("markets"), times: z.array(z.string()) }).strict(),
]);

export const deliverableSchema: z.ZodType<Deliverable, z.ZodTypeDef, unknown> = z.discriminatedUnion("shape", [
  z.object({ shape: z.literal("fields"), node: nodeSchema.nullable(), fields: z.array(fieldSpecSchema).min(1) }).strict(),
  z
    .object({
      shape: z.literal("list"),
      node: nodeSchema,
      item: findingKind,
      classes: z.array(z.string()).min(1),
      parts: z.array(itemPartSchema),
      stop: z.object({ kind: z.literal("saturation"), quietRun: z.record(z.number().int().positive()) }).strict(),
    })
    .strict(),
  z
    .object({
      shape: z.literal("per_item"),
      node: nodeSchema,
      over: itemSourceSchema,
      needs: z.array(itemNeedSchema).min(1),
      oneMarked: z.object({ key: z.string(), record: findingKind, field: z.string(), value: z.string(), describe: z.string() }).strict().optional(),
    })
    .strict(),
]);

/** The definition of done for one task, written for it: what its primitive must cover, what it may read, and what it may spend. */
export const taskContractSchema = z
  .object({
    objective: z.string().min(1),
    primitive: z.enum(PRIMITIVE_NAMES),
    complete: deliverableSchema,
    inputs: z
      .object({ finding_ids: z.array(z.string()).default([]), document_ids: z.array(z.string()).default([]) })
      .strict()
      .default({}),
    budget: z.object({ max_usd: z.number().positive(), max_minutes: z.number().positive() }).strict(),
    verify: z.enum(VERIFIERS).default("code"),
    stop_when: z.string().optional(),
  })
  .strict();
export type TaskContract = z.infer<typeof taskContractSchema>;

/** What starts a task: the subject it is about, and its contract. */
export const taskRequestSchema = z.object({ brief: briefSchema, contract: taskContractSchema }).strict();
export type TaskRequest = z.infer<typeof taskRequestSchema>;
