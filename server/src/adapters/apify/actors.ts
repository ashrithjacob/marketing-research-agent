export const AMAZON_REVIEWS_ACTOR = "junglee/amazon-reviews-scraper";
export const TRUSTPILOT_ACTOR = "memo23/trustpilot-scraper-ppe";
export const AMAZON_SEARCH_ACTOR = "junglee/free-amazon-product-scraper";

export const MIN_CAP_USD = {
  [AMAZON_REVIEWS_ACTOR]: 0.5,
  [TRUSTPILOT_ACTOR]: 0.45,
  [AMAZON_SEARCH_ACTOR]: 0.005,
} as const satisfies Record<string, number>;

const UNIT_PRICE_USD = {
  [AMAZON_REVIEWS_ACTOR]: 0.006,
  [TRUSTPILOT_ACTOR]: 0.00075,
  [AMAZON_SEARCH_ACTOR]: 0.012,
} as const satisfies Record<string, number>;

const START_FEE_USD = { [TRUSTPILOT_ACTOR]: 0.05 } as const;

/** Apify rejects a cap below the actor's floor, so this sizes from volume and floors it. */
export class Spend {
  static capFor(actorId: keyof typeof UNIT_PRICE_USD, items: number): number {
    const start = (START_FEE_USD as Record<string, number>)[actorId] ?? 0;
    const need = start + Math.max(items, 1) * UNIT_PRICE_USD[actorId] * 2;
    return Math.max(MIN_CAP_USD[actorId], Number(need.toFixed(4)));
  }
}

export const STAR_BAND: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "oneStar",
  2: "twoStar",
  3: "threeStar",
  4: "fourStar",
  5: "fiveStar",
};
