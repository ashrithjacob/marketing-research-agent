import type { CompetitorProfile, ProductBrief, Resolution } from "../src/domain/index.js";

export const PRODUCT_URL = "https://mullevia.com/products/mullein-drops";
export const DROPS_URL = "https://lungclear.com/products/mullein-tincture";
export const GUMMIES_URL = "https://breathegummies.com/products/mullein-gummies";
export const TEA_URL = "https://chesttea.com/products/herbal-tea";

export const PAGES: Record<string, string> = {
  [PRODUCT_URL]: "Mullevia Mullein Drops. 60 mL. Mullein leaf extract 1000 mg per serving. $32.95. Supports clear breathing.",
  [DROPS_URL]: "LungClear Mullein Tincture. Mullein leaf 900 mg. $29.00.",
  [GUMMIES_URL]: "Breathe Gummies. Mullein 500 mg. $24.00.",
  [TEA_URL]: "Chest Tea. Thyme and licorice root. $12.00.",
};

export const SEARCH_HITS = [DROPS_URL, GUMMIES_URL, TEA_URL].map((url) => ({ title: url, url, snippet: "" }));

export const RESOLUTION: Resolution = {
  product: { brand: "Mullevia", name: "Mullein Drops", url: PRODUCT_URL },
  alternatives: [],
  competitors: [
    { brand: "LungClear", product_name: "Mullein Tincture", url: DROPS_URL, why: "same herb, same drops" },
    { brand: "Breathe", product_name: "Mullein Gummies", url: GUMMIES_URL, why: "same herb as gummies" },
    { brand: "Chest Tea", product_name: "Herbal Tea", url: TEA_URL, why: "same problem, a tea" },
  ],
};

export const BRIEF: ProductBrief = {
  brand: "Mullevia",
  name: "Mullein Drops",
  category: "lung-support supplement",
  form_factor: "liquid_drops",
  key_active: "Mullein leaf extract",
  price: { amount: 32.95, currency: "USD", source_url: PRODUCT_URL },
  offer: { bundles: [], subscription: null, guarantee: null, source_url: PRODUCT_URL },
  ingredients: [{ name: "Mullein leaf extract", dose: 1000, unit: "mg", source_url: PRODUCT_URL }],
  claims_on_page: [{ text: "Supports clear breathing.", source_url: PRODUCT_URL }],
};

export class Profiles {
  static of(url: string, form: CompetitorProfile["form_factor"], hasMullein: boolean): CompetitorProfile {
    return {
      platform: "shopify",
      form_factor: form,
      has_key_active: hasMullein,
      key_active_as_listed: hasMullein ? "Mullein leaf" : null,
      price: null,
      positioning: "Supports the lungs.",
      sources: [url],
    };
  }
}
