import { stageTwoPlanSchema, type MiningTarget, type StageTwoPlan } from "../domain/index.js";

import {
  AMAZON_REVIEWS_ACTOR,
  TRUSTPILOT_ACTOR,
  START_FEE_USD,
  UNIT_PRICE_USD,
} from "../adapters/apify/actors.js";
import { Trace } from "../trace/index.js";

/** The stage-2 go-ahead a human approves: which targets, mined from where, and what it costs. */
export class StageTwoPlanner {
  static readonly BANDS = 5;

  constructor(private readonly reviewsPerBand: number) {}

  plan(subject: MiningTarget, offered: readonly MiningTarget[], chosen: readonly MiningTarget[], sourceRunId: string): StageTwoPlan | null {
    Trace.line(import.meta.url, "StageTwoPlanner.plan", { offered: offered.length, chosen: chosen.length, sourceRunId });
    if (offered.length === 0) return null;
    const amazonTargets = chosen.filter((t) => t.amazon_url).length;
    const trustpilotTargets = chosen.filter((t) => !t.amazon_url && t.trustpilot).length;
    const amazonReviews = amazonTargets * StageTwoPlanner.BANDS * this.reviewsPerBand;
    const trustpilotReviews = trustpilotTargets * this.reviewsPerBand;
    const amazon = amazonReviews * UNIT_PRICE_USD[AMAZON_REVIEWS_ACTOR];
    const trustpilot = trustpilotTargets * (START_FEE_USD[TRUSTPILOT_ACTOR] + this.reviewsPerBand * UNIT_PRICE_USD[TRUSTPILOT_ACTOR]);
    return stageTwoPlanSchema.parse({
      source_run_id: sourceRunId,
      subject,
      offered: [...offered],
      targets: [...chosen],
      estimate: {
        targets: chosen.length,
        reviews_per_target: StageTwoPlanner.BANDS * this.reviewsPerBand,
        bands: StageTwoPlanner.BANDS,
        reviews: amazonReviews + trustpilotReviews,
        amazon_usd: Number(amazon.toFixed(4)),
        trustpilot_usd: Number(trustpilot.toFixed(4)),
        cost_usd: Number((amazon + trustpilot).toFixed(4)),
        arithmetic:
          `${amazonTargets} Amazon targets x ${StageTwoPlanner.BANDS} bands x ${this.reviewsPerBand} reviews ` +
          `x $${UNIT_PRICE_USD[AMAZON_REVIEWS_ACTOR]} + ${trustpilotTargets} Trustpilot targets x ` +
          `($${START_FEE_USD[TRUSTPILOT_ACTOR]} start + ${this.reviewsPerBand} x $${UNIT_PRICE_USD[TRUSTPILOT_ACTOR]})`,
      },
    });
  }
}
