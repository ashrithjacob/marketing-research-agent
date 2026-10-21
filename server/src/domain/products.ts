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

const AmountSchema = z.object({ amount: z.number().positive(), unit: z.string().min(1).describe("As printed, e.g. ml, fl oz, capsules.") });

export const PackSchema = z.object({
  net_contents: AmountSchema.nullable().describe("What one container holds, e.g. 60 ml."),
  serving_size: AmountSchema.nullable().describe("One serving, e.g. 2 ml."),
  servings_per_container: z.number().positive().nullable().describe("As printed on the label."),
  servings_per_day: z.number().positive().nullable().describe("From the label's main directions: 1 ml twice daily is 2."),
  directions_as_printed: z.string().nullable(),
  ...sourced,
});
export type Pack = z.infer<typeof PackSchema>;

export const PricePointSchema = PriceSchema.extend({
  label: z.string().min(1).describe("How the page names this option, e.g. Buy 2 Get 1 Free."),
  units: z.number().int().positive().describe("Containers this price buys."),
  subscription: z.boolean(),
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
  price_points: z.array(PricePointSchema).describe("Every price the product sells at: one container, each bundle, each subscription price."),
  subscription_terms: z
    .object({
      frequency: z.string().nullable().describe("e.g. every 30 days."),
      minimum_orders: z.number().int().positive().nullable(),
      how_to_cancel: z.string().nullable(),
      ...sourced,
    })
    .nullable(),
  pack: PackSchema.nullable(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        dose: z.number().nullable(),
        unit: z.string().nullable(),
        form: z.string().nullable().describe("Part and preparation as printed, e.g. leaf, 1:5 extract."),
        standardisation: z.string().nullable().describe("e.g. std. to 2400 GDU/g."),
        in_proprietary_blend: z.boolean(),
        ...sourced,
      }),
    )
    .min(1),
  claims_on_page: z.array(z.object({ text: z.string().min(1).describe("The claim, word for word."), ...sourced })),
  coa_url: z.url().nullable().describe("The certificate of analysis, when the brand publishes one."),
  miscellaneous: z
    .array(z.object({ label: z.string().min(1), value: z.string().min(1), ...sourced }))
    .describe("Anything else on the pages a copywriter would want that no field above holds: certifications, origin, warnings, free-from marks, awards."),
});

export type ProductBrief = z.infer<typeof ProductBriefSchema>;
export type Price = z.infer<typeof PriceSchema>;
export type PricePoint = z.infer<typeof PricePointSchema>;

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
  price_points: ProductBrief["price_points"];
  subscription_terms: ProductBrief["subscription_terms"];
  pack: Pack | null;
  ingredients: ProductBrief["ingredients"];
  claims_on_page: ProductBrief["claims_on_page"];
  coa_url: string | null;
  miscellaneous: ProductBrief["miscellaneous"];
  image_url: string | null;
  logo_url: string | null;
  traction: ShopTraction | null;
  created_at: string;
  updated_at: string;
}
