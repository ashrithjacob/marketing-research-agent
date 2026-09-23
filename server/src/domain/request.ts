import { z } from "zod";

import { briefSchema } from "./brief.js";
import { nodeSchema } from "./nodes.js";
import { JUDGEMENT_KINDS, sourceKindSchema } from "./vocabulary.js";

export const judgementInSchema = z
  .object({
    kind: z.enum(JUDGEMENT_KINDS).default("custom"),
    text: z.string(),
    rejects_kinds: z.array(sourceKindSchema).default([]),
  })
  .strict();
export type JudgementIn = z.infer<typeof judgementInSchema>;

export const runRequestSchema = z
  .object({
    brief: briefSchema,
    model: z.string().default(""),
    reject_kinds: z.array(sourceKindSchema).default([]),
    nodes: z.array(nodeSchema).default([]),
  })
  .strict();
export type RunRequest = z.infer<typeof runRequestSchema>;
