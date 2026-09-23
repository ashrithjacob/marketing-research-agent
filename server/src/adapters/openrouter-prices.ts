import type { Rates } from "./rates.js";
import { Money } from "./rates.js";

type FetchLike = typeof fetch;

const OPENROUTER_API = "https://openrouter.ai/api/v1";
const PRICE_REFRESH_MS = 6 * 60 * 60 * 1000;
const LOOKUP_DELAYS_MS = [1000, 2000, 3000, 5000, 8000, 10000];

/** OpenRouter's live list prices, and what a finished generation was billed. */
export class OpenRouterPrices {
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
        const rates = Money.rates(entry.pricing);
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

  ratesFor(modelId: string): { rates: Rates | undefined; fetchedAt: string } {
    return { rates: this.rates.get(modelId), fetchedAt: this.fetchedAt };
  }

  get billable(): boolean {
    return this.apiKey !== "";
  }

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

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.controller.abort();
  }
}

