import { z } from "zod/v4";

import { Trace } from "../trace/index.js";

import { FORM_FACTORS, PriceSchema, type FormFactor, type Price } from "./products.js";

export const PLATFORMS = ["shopify", "amazon", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const RELATIONSHIPS = ["direct", "indirect", "other"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const COMPETITOR_STATUSES = ["proposed", "confirmed"] as const;
export type CompetitorStatus = (typeof COMPETITOR_STATUSES)[number];

/** A competitor as the user confirms it: a brand and the product page that represents it. */
export const CompetitorPickSchema = z.object({
  brand: z.string().trim().min(1),
  product_name: z.string().trim().min(1),
  url: z.url(),
});
export type CompetitorPick = z.infer<typeof CompetitorPickSchema>;

/** What stage 1 reads off one competitor's product page. Its relationship to the client is decided by code from these fields, never by the agent. */
export const CompetitorProfileSchema = z.object({
  platform: z.enum(PLATFORMS),
  form_factor: z.enum(FORM_FACTORS).describe("Tinctures count as liquid_drops."),
  has_key_active: z.boolean().describe("Whether the label or ingredient list includes the client's key active."),
  key_active_as_listed: z.string().nullable().describe("How this product's page names that ingredient, or null when it lacks it."),
  price: PriceSchema.nullable(),
  positioning: z.string().min(1).describe("The product's main claim, in a sentence."),
  sources: z.array(z.url()).min(1).describe("Pages you fetched with web_fetch for this profile."),
});
export type CompetitorProfile = z.infer<typeof CompetitorProfileSchema>;

export interface Competitor {
  id: string;
  account_id: string;
  product_id: string;
  status: CompetitorStatus;
  brand: string;
  product_name: string;
  url: string;
  domain: string;
  platform: Platform | null;
  relationship: Relationship | null;
  form_factor: FormFactor | null;
  has_key_active: boolean | null;
  key_active: string | null;
  price: Price | null;
  positioning: string;
  sources: string[];
  rank_score: number | null;
  rank_in_group: number | null;
  created_at: string;
  updated_at: string;
}

/** Direct shares the client's key active and form factor; indirect shares the key active only; anything without it is context. */
export class CompetitorRelationship {
  static classify(client: { form_factor: FormFactor | null }, profile: Pick<CompetitorProfile, "has_key_active" | "form_factor">): Relationship {
    Trace.line(import.meta.url, "CompetitorRelationship.classify", { client: client.form_factor, form: profile.form_factor, has: profile.has_key_active });
    if (!profile.has_key_active) return "other";
    return profile.form_factor === client.form_factor ? "direct" : "indirect";
  }

  static domainOf(url: string): string {
    Trace.line(import.meta.url, "CompetitorRelationship.domainOf", { url });
    return new URL(url).hostname.replace(/^www\./, "");
  }
}
