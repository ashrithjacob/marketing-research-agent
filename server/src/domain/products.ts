import { z } from "zod/v4";

import type { ShopTraction } from "./traction.js";

export const FORM_FACTORS = ["liquid_drops", "capsules", "tablets", "gummies", "powder", "tea", "spray", "syrup", "other"] as const;
export type FormFactor = (typeof FORM_FACTORS)[number];

const sourced = { source_url: z.url().describe("A page you fetched with web_fetch that shows this.") };

export const PriceSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).describe("ISO 4217, e.g. USD, EUR."),
  ...sourced,
});

/** What stage 1 learns about the client's product, every fact tied to a page the agent read. */
export const ProductBriefSchema = z.object({
  brand: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1).describe("A short category name, e.g. lung-support supplement."),
  form_factor: z.enum(FORM_FACTORS).describe("Tinctures count as liquid_drops."),
  key_active: z.string().min(1).describe("The one ingredient the product is sold on, as the label names it."),
  price: PriceSchema.nullable(),
  offer: z.object({
    bundles: z.array(z.string()),
    subscription: z.string().nullable(),
    guarantee: z.string().nullable(),
    ...sourced,
  }),
  ingredients: z
    .array(z.object({ name: z.string().min(1), dose: z.number().nullable(), unit: z.string().nullable(), ...sourced }))
    .min(1),
  claims_on_page: z.array(z.object({ text: z.string().min(1).describe("The claim, word for word."), ...sourced })),
});

export type ProductBrief = z.infer<typeof ProductBriefSchema>;
export type Price = z.infer<typeof PriceSchema>;

/** What a brand looks like on screen: its product shot and its logo, as addresses on the brand's own site; null when the page offers none. */
export interface BrandVisual {
  image_url: string | null;
  logo_url: string | null;
}

export interface Product {
  id: string;
  account_id: string;
  url: string;
  brand: string;
  name: string;
  category: string;
  form_factor: FormFactor | null;
  key_active: string;
  price: Price | null;
  offer: ProductBrief["offer"] | null;
  ingredients: ProductBrief["ingredients"];
  claims_on_page: ProductBrief["claims_on_page"];
  image_url: string | null;
  logo_url: string | null;
  traction: ShopTraction | null;
  created_at: string;
  updated_at: string;
}
