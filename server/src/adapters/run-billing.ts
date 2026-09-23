import type { Billed } from "./rates.js";
import type { OpenRouterPrices } from "./openrouter-prices.js";

/** Collects the per-turn generation lookups for one run and totals them. */
export class RunBilling {
  private readonly lookups: Promise<number | null>[] = [];
  private readonly seen = new Set<string>();

  constructor(private readonly costs: OpenRouterPrices) {}

  track(generationId: unknown): Promise<number | null> | undefined {
    if (!this.costs.billable) return undefined;
    if (typeof generationId !== "string" || !generationId || this.seen.has(generationId)) {
      return undefined;
    }
    this.seen.add(generationId);
    const lookup = this.costs.generationCost(generationId);
    this.lookups.push(lookup);
    return lookup;
  }

  async settle(): Promise<Billed | null> {
    if (this.lookups.length === 0) return null;
    const costs = await Promise.all(this.lookups);
    const resolved = costs.filter((c): c is number => c !== null);
    return {
      total: resolved.reduce((sum, c) => sum + c, 0),
      turns: costs.length,
      resolved: resolved.length,
    };
  }
}

