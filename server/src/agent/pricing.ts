import type { Api, Model } from "@earendil-works/pi-ai";

import type { OpenRouterPrices } from "../adapters/openrouter-prices.js";
import type { Pricing } from "../adapters/rates.js";

/** Writes OpenRouter's live rates onto the pi-ai model a run is started with. */
export class ModelPricing {
  constructor(private readonly prices: OpenRouterPrices) {}

  apply<TApi extends Api>(model: Model<TApi>): { model: Model<TApi>; pricing: Pricing } {
    const { rates: live, fetchedAt } = this.prices.ratesFor(model.id);
    if (!live) {
      const { input, output, cacheRead, cacheWrite } = model.cost;
      return {
        model,
        pricing: {
          source: "pi-ai-snapshot",
          fetched_at: "",
          rates: { input, output, cacheRead, cacheWrite },
        },
      };
    }
    const defined = Object.fromEntries(Object.entries(live).filter(([, v]) => v !== undefined));
    const { tiers: _stale, ...base } = model.cost;
    const cost = { ...base, ...defined };
    return {
      model: { ...model, cost },
      pricing: {
        source: "openrouter-live",
        fetched_at: fetchedAt,
        rates: {
          input: cost.input,
          output: cost.output,
          cacheRead: cost.cacheRead,
          cacheWrite: cost.cacheWrite,
        },
      },
    };
  }
}
