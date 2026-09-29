/**
 * The 23 Amazon listings the lookup found for stage-1 run 99002ee8's roster
 * (mullein, 2026-09-29), read from research_target_listings, with the verdict
 * spec-stage-2-pipeline.md §4.2 requires. c15, c16 and c17 passed the old rule
 * (brand, and "no other form named") while being different products.
 */
export const MULLEIN_LISTINGS: ReadonlyArray<{
  id: string;
  name: string;
  brand: string;
  form: "liquid" | "spray" | "capsule" | "tea" | "gummy";
  actives: string[];
  listingBrand: string;
  title: string;
  expected: "" | "brand" | "active" | "form";
}> = [
  { id: "c1", name: "Mullein Blend Liquid Herbal Extract", brand: "Herb Pharm", form: "liquid", actives: ["mullein"], listingBrand: "Herb Pharm", title: "Herb Pharm Certified Organic Mullein Blend Liquid Extract for Respiratory System Support - 1 Ounce (Pack of 2)", expected: "" },
  { id: "c10", name: "St. Francis Herb Farm - Mullein Tincture (60 mL)", brand: "St. Francis Herb Farm", form: "liquid", actives: ["mullein"], listingBrand: "St. Francis Herb Farm", title: "St. Francis Herb Farm Mullein (100ml) Organic Mullein Extract that Helps Support Cough Pain Relief, Made in Canada, Crafted With Care (1 Bottle) Traditional Herbal Expertise Since 1988", expected: "" },
  { id: "c11", name: "Mullein 1:1 Organic Glycetract – Alcohol-Free Mullein Drops", brand: "Inseason Herbals NZ", form: "liquid", actives: ["mullein"], listingBrand: "Star-wood", title: "Organic Mullein Leaf Extract 60ml | Natural Mullein Liquid Drops | Plant-Based, Vegan-Friendly Formula | Fast-Absorbing | Alcohol-Free & Non-GMO | Pack of 2", expected: "brand" },
  { id: "c12", name: "Baldwins Mullein (Verbascum Thapsus) Herbal Tincture", brand: "Baldwins", form: "liquid", actives: ["mullein"], listingBrand: "Caley's Apothecary", title: "Mullein Tincture (Verbascum thapsus) (300ml)", expected: "brand" },
  { id: "c13", name: "Mullein Leaf Tea", brand: "Buddha Teas", form: "tea", actives: ["mullein"], listingBrand: "Buddha Teas", title: "Buddha Teas Mullein Leaf Tea, 18 Count (Pack of 6)", expected: "" },
  { id: "c14", name: "Swanson Mullein Leaf Extract - Standardized", brand: "Swanson Vitamins", form: "capsule", actives: ["mullein"], listingBrand: "Swanson", title: "Swanson Mullein Leaf Extract, Standardized, 250 mg, 60 Capsules", expected: "" },
  { id: "c15", name: "Mullein-X Throat Spray", brand: "Nature's Answer", form: "spray", actives: ["mullein", "ginger"], listingBrand: "Nature's Answer", title: "Nature's Answer Mullein Leaf Herbal Supplement - 1oz, Non-GMO, Gluten-Free", expected: "form" },
  { id: "c16", name: "A.Vogel Mullein & Marshmallow Spray", brand: "A.Vogel", form: "spray", actives: ["mullein"], listingBrand: "A.Vogel", title: "A.Vogel Sinuforce Nasal Spray + Menthol | Provides Fast Relief for Blocked Nose, Congestion & Nasal Catarrh | with Eucalyptus, Peppermint & Chamomile Oil | Suitable for Longer Term use | 20ml", expected: "active" },
  { id: "c17", name: "Mighty Lungs™, 60 Liquid Phyto-Caps®", brand: "Gaia Herbs", form: "capsule", actives: ["mullein"], listingBrand: "Gaia Herbs", title: "Gaia Herbs Sinus & Lung Supreme, 60 Vegan Capsules, 60 Servings", expected: "active" },
  { id: "c18", name: "BetterLungs® Mullein Gummies", brand: "Betterbrand", form: "gummy", actives: ["mullein"], listingBrand: "Betterbrand", title: "Betterbrand Respiratory Support Mullein Gummies, 2000mg, Pear Flavor", expected: "" },
  { id: "c19", name: "BetterLungs® Mullein + Chlorophyll (Mint Flavor)", brand: "Betterbrand", form: "liquid", actives: ["mullein"], listingBrand: "Betterbrand", title: "Betterbrand Mullein Drops, Alchohol-Free Lung Detox with Chlorophyll", expected: "" },
  { id: "c2", name: "Mullein Extract - Alcohol Free Liquid", brand: "Nature's Answer", form: "liquid", actives: ["mullein"], listingBrand: "Nature's Answer", title: "Nature's Answer Mullein Leaf with Organic Alcohol 2000mg 2oz Extract | Supports Respiratory Function | Vegan, Non-GMO, Gluten-Free, Kosher | Single Count", expected: "" },
  { id: "c20", name: "Mullein Leaf Extract Drops | 60 ml", brand: "Horbäach", form: "liquid", actives: ["mullein"], listingBrand: "Horbäach", title: "Mullein Leaf Extract Drops - High Strength 1000mg Liquid - 60ml", expected: "" },
  { id: "c21", name: "Herb Pharm Mullein 30ml Organic", brand: "Herb Pharm UK", form: "liquid", actives: ["mullein"], listingBrand: "Herb Pharm", title: "Herb Pharm Certified Organic Mullein Blend Liquid Herbal Extract 30ml | Traditionally Used for Soothing Congestion & Irritation | Herbal Food Supplement", expected: "" },
  { id: "c22", name: "Mullein Extract by Herbify", brand: "Herbify", form: "liquid", actives: ["mullein"], listingBrand: "HERBIFY", title: "HERBIFY Mullein Drops - Lung Cleanse - Leaf Extract - Powerful Mullein for Immune Support, Detox & Respiratory Support - Made in USA - 4 Oz Strawberry Flavor", expected: "" },
  { id: "c3", name: "Mullein Leaf Extract | 2oz Liquid", brand: "Horbäach", form: "liquid", actives: ["mullein"], listingBrand: "Horbäach", title: "Horbäach Mullein Leaf Extract Drops | 2 fl oz", expected: "" },
  { id: "c4", name: "USDA Organic Mullein + Echinacea Drops - 4 Fl. Oz. Bottle", brand: "Herbamama", form: "liquid", actives: ["mullein"], listingBrand: "HERBAMAMA", title: "HERBAMAMA USDA Organic Mullein Drops for Lungs - Lung Cleanse - 4 oz", expected: "" },
  { id: "c5", name: "Mullein Leaf Extract (Organic, 1000 mg)", brand: "Liquid Health", form: "liquid", actives: ["mullein"], listingBrand: "NUTRAHARMONY", title: "Mullein Drops for Lungs - USDA Organic Mullein Leaf Extract Liquid - 4 oz", expected: "brand" },
  { id: "c6", name: "Lung Clear Pro Lung Support Supplement Drops", brand: "Lung Clear Pro", form: "liquid", actives: ["mullein", "cordyceps", "bromelain", "ginger", "lemon peel"], listingBrand: "LUNG CLEAR PRO", title: "Lung Support Supplement Drops with Wild Mullein Leaf Extract for Lungs and Mucus Relief Support - 2 Fl oz - 3 Bottles", expected: "" },
  { id: "c7", name: "Wanderlust Mullein Drops 90ml", brand: "Wanderlust", form: "liquid", actives: ["mullein"], listingBrand: "Generic", title: "Mullein Leaf Extract Liquid Drops | 30:1 Extract with Chlorophyll | Lung & Respiratory Support | Non-GMO, Gluten Free, Vegan, Alcohol-Free | 60mL", expected: "brand" },
  { id: "c8", name: "A.Vogel Mullein Respiratory Health oral drops", brand: "A.Vogel", form: "liquid", actives: ["mullein"], listingBrand: "A.Vogel", title: "A.Vogel Mullein Respiratory Health Oral Drops | 50ml", expected: "" },
  { id: "c9", name: "Mullein Leaf Extract 150mg - 60ml Drops Per Bottle", brand: "Nutravita", form: "liquid", actives: ["mullein"], listingBrand: "NUTRAHARMONY", title: "Mullein Drops for Lungs - USDA Organic Mullein Leaf Extract Liquid - 2 oz", expected: "brand" },
  { id: "product", name: "Mullevia Mullein Drops", brand: "", form: "liquid", actives: ["mullein", "ginger", "bromelain", "cordyceps", "lemon peel"], listingBrand: "Nature's Answer", title: "Nature's Answer Mullein Leaf Herbal Supplement - 1oz, Non-GMO, Gluten-Free", expected: "brand" },
];
