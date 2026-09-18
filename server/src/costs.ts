/**
 * What a run costs, two ways.
 *
 * **Calculated:** pi-ai prices every turn itself, from `model.cost`. Out of the
 * box that is a table frozen into the package when it was published — pi-ai's
 * OpenRouter provider has no `fetchModels`, so it never refreshes. Measured
 * 2026-09-18 for `deepseek-v4-flash-0731`: the snapshot said $0.065/$0.18/$0.016
 * per M (input/output/cache read), OpenRouter said $0.06/$0.12/$0.012, and the
 * Mullein run came out ~27% high. `OpenRouterCosts` keeps OpenRouter's current
 * list prices and `price()` writes them onto the model a run is started with, so
 * pi-ai's own arithmetic uses them.
 *
 * **Billed:** a list price is still an estimate — OpenRouter routes to whichever
 * upstream it picks. The final stream chunk carries the real `usage.cost`, but
 * pi-ai's parser drops it, and its `onResponse` hook sees headers only. So each
 * turn's `responseId` (the `gen-…` id) is looked up on `/generation`, which
 * returns `total_cost`. Measured: the lookup 404s for ~4s after the stream ends,
 * then answers — hence the retry schedule.
 */

import type { Api, Model } from "@earendil-works/pi-ai";

type FetchLike = typeof fetch;

const OPENROUTER_API = "https://openrouter.ai/api/v1";
const PRICE_REFRESH_MS = 6 * 60 * 60 * 1000;
/** ~30s in total: comfortably past the ~4s measured, without holding a run open. */
const LOOKUP_DELAYS_MS = [1000, 2000, 3000, 5000, 8000, 10000];

/** Dollars per million tokens — pi-ai's unit for `model.cost`. */
export interface Rates {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

/** Where a run's calculated cost got its rates. Stored with the run's usage. */
export interface Pricing {
  source: "openrouter-live" | "pi-ai-snapshot";
  /** When the live prices were fetched; empty for the snapshot. */
  fetched_at: string;
  rates: Rates;
}

/** What OpenRouter actually charged. `resolved < turns` means some lookups failed. */
export interface Billed {
  total: number;
  turns: number;
  resolved: number;
}

/** OpenRouter's `pricing` strings are dollars per token; "-1" marks a router model. */
function perMillion(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n * 1_000_000 : undefined;
}

export function parseRates(pricing: Record<string, unknown> | undefined): Rates | undefined {
  if (!pricing) return undefined;
  const rates: Rates = {
    input: perMillion(pricing.prompt),
    output: perMillion(pricing.completion),
    cacheRead: perMillion(pricing.input_cache_read),
    cacheWrite: perMillion(pricing.input_cache_write),
  };
  if (rates.input === undefined || rates.output === undefined) return undefined;
  return rates;
}

export class OpenRouterCosts {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetch: FetchLike;
  private readonly delaysMs: readonly number[];
  private readonly controller = new AbortController();
  private rates = new Map<string, Rates>();
  private fetchedAt = "";
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: {
    apiKey: string;
    baseUrl?: string;
    fetch?: FetchLike;
    lookupDelaysMs?: readonly number[];
  }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? OPENROUTER_API;
    this.fetch = options.fetch ?? fetch;
    this.delaysMs = options.lookupDelaysMs ?? LOOKUP_DELAYS_MS;
  }

  // -- calculated -------------------------------------------------------

  /** Fetch now and every six hours. A failed fetch keeps the last good prices. */
  start(): void {
    void this.refreshPrices();
    this.timer = setInterval(() => void this.refreshPrices(), PRICE_REFRESH_MS);
    this.timer.unref?.();
  }

  async refreshPrices(): Promise<void> {
    try {
      const response = await this.fetch(`${this.baseUrl}/models`, {
        signal: this.controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { data?: Array<Record<string, any>> };
      const next = new Map<string, Rates>();
      for (const entry of body.data ?? []) {
        const rates = parseRates(entry.pricing);
        if (typeof entry.id === "string" && rates) next.set(entry.id, rates);
      }
      if (next.size === 0) throw new Error("no priced models in the response");
      this.rates = next;
      this.fetchedAt = new Date().toISOString();
    } catch (error) {
      if (this.controller.signal.aborted) return;
      console.error("openrouter prices: refresh failed, keeping the previous prices", error);
    }
  }

  /**
   * The model with OpenRouter's current rates on it, and a record of which
   * rates those were. Fields OpenRouter does not list keep the snapshot's value.
   * Tiers are dropped with live rates: they came from the same stale snapshot.
   */
  price<TApi extends Api>(model: Model<TApi>): { model: Model<TApi>; pricing: Pricing } {
    const live = this.rates.get(model.id);
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
        fetched_at: this.fetchedAt,
        rates: {
          input: cost.input,
          output: cost.output,
          cacheRead: cost.cacheRead,
          cacheWrite: cost.cacheWrite,
        },
      },
    };
  }

  // -- billed -----------------------------------------------------------

  /** No key, no lookups: `/generation` is authenticated. */
  get billable(): boolean {
    return this.apiKey !== "";
  }

  /** What OpenRouter charged for one generation, or null if it never said. */
  async generationCost(id: string): Promise<number | null> {
    const url = `${this.baseUrl}/generation?id=${encodeURIComponent(id)}`;
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await this.fetch(url, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: this.controller.signal,
        });
        if (response.ok) {
          const body = (await response.json()) as { data?: { total_cost?: unknown } };
          const cost = Number(body.data?.total_cost);
          return Number.isFinite(cost) ? cost : null;
        }
        // 404 is "not recorded yet" — the only status worth waiting out.
        if (response.status !== 404) {
          console.error(`openrouter generation ${id}: HTTP ${response.status}`);
          return null;
        }
      } catch (error) {
        if (this.controller.signal.aborted) return null;
        console.error(`openrouter generation ${id}: lookup failed`, error);
      }
      const delay = this.delaysMs[attempt];
      if (delay === undefined || !(await this.sleep(delay))) return null;
    }
  }

  /** Resolves false if the service is stopping. */
  private sleep(ms: number): Promise<boolean> {
    const signal = this.controller.signal;
    if (signal.aborted) return Promise.resolve(false);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve(true);
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        resolve(false);
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  /** Stop refreshing and abandon every pending lookup. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.controller.abort();
  }
}

/** One run's generation lookups, started as each turn ends and summed at the end. */
export class RunBilling {
  private readonly lookups: Promise<number | null>[] = [];
  private readonly seen = new Set<string>();

  constructor(private readonly costs: OpenRouterCosts) {}

  /** The lookup for this turn, so a caller can attribute its cost; undefined if none was started. */
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

  /** Null when no turn had an id to look up — nothing was measured, so say nothing. */
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
