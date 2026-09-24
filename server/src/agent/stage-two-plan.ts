import { stageTwoPlanSchema, type MiningTarget, type StageTwoPlan } from "../domain/index.js";

import {
  AMAZON_REVIEWS_ACTOR,
  AMAZON_SEARCH_ACTOR,
  TRUSTPILOT_ACTOR,
  START_FEE_USD,
  UNIT_PRICE_USD,
} from "../adapters/apify/actors.js";

/** The stage-2 go-ahead a human approves: which targets, how many reviews, what it costs. */
export class StageTwoPlanner {
  static readonly BANDS = 5;

  constructor(private readonly reviewsPerBand: number) {}

  plan(targets: readonly MiningTarget[], sourceRunId: string): StageTwoPlan | null {
    if (targets.length === 0) return null;
    const perTargetReviews = StageTwoPlanner.BANDS * this.reviewsPerBand;
    const reviews = targets.length * perTargetReviews;
    const amazon =
      targets.length * UNIT_PRICE_USD[AMAZON_SEARCH_ACTOR] +
      reviews * UNIT_PRICE_USD[AMAZON_REVIEWS_ACTOR];
    const trustpilot =
      START_FEE_USD[TRUSTPILOT_ACTOR] +
      reviews * UNIT_PRICE_USD[TRUSTPILOT_ACTOR];
    return stageTwoPlanSchema.parse({
      source_run_id: sourceRunId,
      subject: targets[0]!,
      targets: [...targets],
      estimate: {
        targets: targets.length,
        reviews_per_target: perTargetReviews,
        bands: StageTwoPlanner.BANDS,
        reviews,
        amazon_usd: Number(amazon.toFixed(4)),
        trustpilot_usd: Number(trustpilot.toFixed(4)),
        cost_usd: Number((amazon + trustpilot).toFixed(4)),
        arithmetic:
          `${targets.length} targets x (1 resolver result $${UNIT_PRICE_USD[AMAZON_SEARCH_ACTOR]} + ` +
          `${StageTwoPlanner.BANDS} bands x ${this.reviewsPerBand} reviews $${UNIT_PRICE_USD[AMAZON_REVIEWS_ACTOR]}) ` +
          `+ Trustpilot $${START_FEE_USD[TRUSTPILOT_ACTOR]} start + ${reviews} x $${UNIT_PRICE_USD[TRUSTPILOT_ACTOR]}`,
      },
    });
  }
}
