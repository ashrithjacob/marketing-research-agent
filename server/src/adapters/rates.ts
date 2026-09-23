export interface Rates {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export interface Pricing {
  source: "openrouter-live" | "pi-ai-snapshot";
  fetched_at: string;
  rates: Rates;
}

export interface Billed {
  total: number;
  turns: number;
  resolved: number;
}

/** OpenRouter quotes per token; everything downstream works per million. */
export class Money {
  static perMillion(value: unknown): number | undefined {
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed * 1_000_000 : undefined;
  }

  static rates(pricing: Record<string, unknown> | undefined): Rates | undefined {
    if (!pricing) return undefined;
    const rates: Rates = {
      input: Money.perMillion(pricing.prompt),
      output: Money.perMillion(pricing.completion),
      cacheRead: Money.perMillion(pricing.input_cache_read),
      cacheWrite: Money.perMillion(pricing.input_cache_write),
    };
    if (rates.input === undefined || rates.output === undefined) return undefined;
    return rates;
  }
}
