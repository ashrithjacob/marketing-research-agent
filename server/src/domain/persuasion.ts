import { z } from "zod";

/** What a competitor's ad adds to persuade, in the order a market's skepticism demands them: each element is the stage of the same number. */
export const PERSUASION_ELEMENTS = ["claim", "amplifier", "mechanism", "proof", "identity"] as const;
export type PersuasionElement = (typeof PERSUASION_ELEMENTS)[number];

/** One competitor ad or page, and which persuasion elements it uses. */
export const adElementsSchema = z
  .object({
    brand: z.string().trim().min(1),
    source_id: z.string().min(1),
    elements: z.array(z.enum(PERSUASION_ELEMENTS)).min(1),
  })
  .strict();
export type AdElements = z.infer<typeof adElementsSchema>;

/** How many of the tagged brands use one element, in at least one ad. */
export const elementShareSchema = z.object({ element: z.enum(PERSUASION_ELEMENTS), brands: z.number().int(), of: z.number().int() }).strict();
export type ElementShare = z.infer<typeof elementShareSchema>;

/** Where one buyer stands, read from their own words, in the order skepticism grows: the persona-side reading of the same five stages. */
export const BUYER_STAGES = ["beginner", "explorer", "researcher", "skeptic", "hopeless"] as const;
export type BuyerStage = (typeof BUYER_STAGES)[number];

/** One customer voice (a review, a forum post), who it is, and where they stand. */
export const buyerStageSchema = z
  .object({
    source_id: z.string().min(1),
    who: z.string().trim().min(1),
    stage: z.enum(BUYER_STAGES),
  })
  .strict();
export type BuyerStageRow = z.infer<typeof buyerStageSchema>;

/** How many of the tagged customer voices stand at one stage. */
export const buyerStageShareSchema = z.object({ stage: z.enum(BUYER_STAGES), voices: z.number().int(), of: z.number().int() }).strict();
export type BuyerStageShare = z.infer<typeof buyerStageShareSchema>;
