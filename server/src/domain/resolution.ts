import { z } from "zod/v4";

import { CompetitorPickSchema } from "./competitors.js";

/** What the resolver proposes before anything is spent on scraping: the product it found, other candidates when only a name was given, and competitors for the user to keep or drop. */
export const ResolutionSchema = z.object({
  product: z.object({
    brand: z.string().min(1),
    name: z.string().min(1),
    url: z.url().describe("The product's own page, fetched with web_fetch."),
  }),
  alternatives: z
    .array(z.object({ name: z.string().min(1), url: z.url() }))
    .max(5)
    .describe("Other products the name could mean; empty when the product was given by url."),
  competitors: z
    .array(CompetitorPickSchema.extend({ why: z.string().min(1).describe("One line: why a buyer of the product would consider this.") }))
    .min(3)
    .max(15),
});

export type Resolution = z.infer<typeof ResolutionSchema>;

/** What the user approves: the product page and the competitors to research. */
export const ConfirmationSchema = z.object({
  product_url: z.url(),
  competitors: z.array(CompetitorPickSchema).min(1).max(15),
});

export type Confirmation = z.infer<typeof ConfirmationSchema>;
