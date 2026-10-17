import { z } from "zod";

import { BUYER_STAGES } from "./persuasion.js";
import { Trace } from "../trace/index.js";

/** What a customer's words do, as the language bank sorts them. */
export const QUOTE_FUNCTIONS = ["pain", "outcome", "objection", "proof"] as const;
export const IDENTITY_KINDS = ["label_self", "label_others", "guilt", "loss", "feared_identity"] as const;
export const EMOTIONS = ["fear", "guilt", "shame", "grief", "anger", "helplessness"] as const;
export const INTENSITIES = ["low", "medium", "high"] as const;
export const DURATIONS = ["acute", "chronic", "episodic"] as const;
export const SOCIAL = ["private", "visible", "relationship"] as const;
export const BLAME = ["outward", "inward", "mixed"] as const;
export const PROVENANCE = ["evidenced", "inferred"] as const;
export const CHANNELS = ["cold_social", "category_search", "branded_search", "marketplace", "retargeting"] as const;
export const AWARENESS_LEVELS = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"] as const;
export type AwarenessLevel = (typeof AWARENESS_LEVELS)[number];

/** A customer's own words, copied by code from a mined review or an archived page; no model types them. */
export const quoteSchema = z
  .object({
    review_ref: z.string().default(""),
    source_id: z.string().default(""),
    text: z.string().min(1),
    star: z.number().int().min(1).max(5).nullable().default(null),
    posted_at: z.string().default(""),
    paragraphs: z.string().default(""),
    function: z.enum(QUOTE_FUNCTIONS),
    buyer_stage: z.enum(BUYER_STAGES).nullable().default(null),
  })
  .strict();
export type Quote = z.infer<typeof quoteSchema>;

const cited = { quote_ids: z.array(z.string().min(1)).default([]), provenance: z.enum(PROVENANCE) };

/** Inference is legitimate; unmarked inference is not: an evidenced row cites the voices that show it. */
class Provenance {
  static readonly message = { message: "an evidenced row cites at least one quote id; mark it inferred if no voice says it" };

  static cited(row: { quote_ids: string[]; provenance: string }): boolean {
    Trace.tick(import.meta.url, "Provenance.cited");
    return row.provenance === "inferred" || row.quote_ids.length > 0;
  }
}

export const identityEntrySchema = z
  .object({ kind: z.enum(IDENTITY_KINDS), summary: z.string().trim().min(1).max(240), ...cited })
  .strict()
  .refine(Provenance.cited, Provenance.message);
export type IdentityEntry = z.infer<typeof identityEntrySchema>;

/** The emotional profile of one major pain, on the compartment's four dimensions. */
export const painProfileSchema = z
  .object({
    pain: z.string().trim().min(1),
    emotion: z.enum(EMOTIONS),
    intensity: z.enum(INTENSITIES),
    duration: z.enum(DURATIONS),
    social: z.enum(SOCIAL),
    ...cited,
  })
  .strict()
  .refine(Provenance.cited, Provenance.message);
export type PainProfile = z.infer<typeof painProfileSchema>;

/** One avatar or sub-avatar (a `parent` names its avatar), built situation first, then history, then demographics. */
export const avatarSchema = z
  .object({
    id: z.string().trim().regex(/^[a-z0-9_]+$/, "a short id in lowercase letters, digits and underscores, such as night_cougher"),
    parent: z.string().nullable().default(null),
    name: z.string().trim().min(1),
    proxy: z.boolean(),
    situation: z.string().trim().min(1),
    history: z.string().trim().min(1),
    demographics: z.string().trim().min(1),
    pains: z.array(z.string().min(1)).min(1),
    outcomes: z.array(z.string().min(1)).min(1),
    objections: z.array(z.string().min(1)).default([]),
    identity: z.string().trim().min(1),
    secondary_gain: z.string().trim().min(1),
    blame: z.enum(BLAME),
    ...cited,
  })
  .strict()
  .refine(Provenance.cited, Provenance.message);
export type Avatar = z.infer<typeof avatarSchema>;

const weights = z.object(Object.fromEntries(AWARENESS_LEVELS.map((level) => [level, z.number().min(0).max(1)])) as Record<AwarenessLevel, z.ZodNumber>).strict();

/** Where one avatar sits on the awareness levels when it arrives from one channel: a spread that sums to 1, and the level to write for. */
export const awarenessSchema = z
  .object({
    avatar_id: z.string().min(1),
    channel: z.enum(CHANNELS),
    weights,
    entry: z.enum(AWARENESS_LEVELS),
    why: z.string().trim().min(1),
    ...cited,
  })
  .strict()
  .refine((row) => Math.abs(Object.values(row.weights).reduce((sum, w) => sum + w, 0) - 1) <= 0.01, { message: "the weights must sum to 1" })
  .refine(Provenance.cited, Provenance.message);
export type Awareness = z.infer<typeof awarenessSchema>;
