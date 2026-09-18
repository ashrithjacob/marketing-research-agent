/**
 * Live prices and billed cost. OpenRouter is stubbed: the shapes below are the
 * ones measured against the real `/models` and `/generation` on 2026-09-18.
 */

import { describe, expect, it } from "vitest";

import { OpenRouterCosts, RunBilling, parseRates } from "../src/costs.js";

type Reply = { status: number; body?: unknown };

/** A fetch that answers from a script, recording every URL it was asked for. */
function scripted(replies: (url: string) => Reply) {
  const calls: string[] = [];
  const fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const { status, body } = replies(url);
    return new Response(JSON.stringify(body ?? {}), { status });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const MODELS = {
  data: [
    {
      id: "deepseek/deepseek-v4-flash-0731",
      pricing: { prompt: "0.00000006", completion: "0.00000012", input_cache_read: "0.000000012" },
    },
    { id: "openrouter/auto", pricing: { prompt: "-1", completion: "-1" } },
  ],
};

function snapshotModel(): any {
  return {
    id: "deepseek/deepseek-v4-flash-0731",
    cost: {
      input: 0.065,
      output: 0.18,
      cacheRead: 0.016,
      cacheWrite: 0,
      tiers: [{ inputTokensAbove: 1, input: 9, output: 9, cacheRead: 9, cacheWrite: 9 }],
    },
  };
}

describe("parseRates", () => {
  it("converts OpenRouter's dollars-per-token strings to pi-ai's dollars per million", () => {
    const rates = parseRates(MODELS.data[0]!.pricing)!;
    expect(rates.input).toBeCloseTo(0.06, 10);
    expect(rates.output).toBeCloseTo(0.12, 10);
    expect(rates.cacheRead).toBeCloseTo(0.012, 10);
    expect(rates.cacheWrite).toBeUndefined();
  });

  it("refuses a router model's -1 sentinel rather than pricing it negative", () => {
    expect(parseRates(MODELS.data[1]!.pricing)).toBeUndefined();
  });
});

describe("calculated cost", () => {
  it("prices a model from the snapshot until live prices arrive, and says so", () => {
    const costs = new OpenRouterCosts({ apiKey: "" });
    const model = snapshotModel();
    const { model: priced, pricing } = costs.price(model);
    expect(priced).toBe(model);
    expect(pricing.source).toBe("pi-ai-snapshot");
    expect(pricing.rates.output).toBe(0.18);
  });

  it("writes live rates onto the model and drops the snapshot's stale tiers", async () => {
    // The snapshot was 50% high on output for this model when measured.
    const { fetch } = scripted(() => ({ status: 200, body: MODELS }));
    const costs = new OpenRouterCosts({ apiKey: "", fetch });
    await costs.refreshPrices();
    const { model, pricing } = costs.price(snapshotModel());
    expect(model.cost.output).toBeCloseTo(0.12, 10);
    expect(model.cost.cacheRead).toBeCloseTo(0.012, 10);
    // Not listed by OpenRouter: keeps the snapshot's value.
    expect(model.cost.cacheWrite).toBe(0);
    expect(model.cost.tiers).toBeUndefined();
    expect(pricing.source).toBe("openrouter-live");
    expect(pricing.fetched_at).not.toBe("");
  });

  it("keeps the last good prices when a refresh fails", async () => {
    let up = true;
    const { fetch } = scripted(() => (up ? { status: 200, body: MODELS } : { status: 503 }));
    const costs = new OpenRouterCosts({ apiKey: "", fetch });
    await costs.refreshPrices();
    up = false;
    await costs.refreshPrices();
    expect(costs.price(snapshotModel()).pricing.source).toBe("openrouter-live");
  });
});

describe("billed cost", () => {
  it("waits out the 404s a fresh generation returns, then reads total_cost", async () => {
    // Measured: /generation 404s for ~4s after the stream ends.
    let asked = 0;
    const { fetch } = scripted(() =>
      ++asked < 3 ? { status: 404 } : { status: 200, body: { data: { total_cost: 8.008e-6 } } },
    );
    const costs = new OpenRouterCosts({ apiKey: "k", fetch, lookupDelaysMs: [0, 0, 0] });
    expect(await costs.generationCost("gen-1")).toBe(8.008e-6);
    expect(asked).toBe(3);
  });

  it("gives up after the retry schedule instead of holding the run open", async () => {
    const { fetch, calls } = scripted(() => ({ status: 404 }));
    const costs = new OpenRouterCosts({ apiKey: "k", fetch, lookupDelaysMs: [0, 0] });
    expect(await costs.generationCost("gen-1")).toBeNull();
    expect(calls).toHaveLength(3);
  });

  it("does not retry an error that waiting will not fix", async () => {
    const { fetch, calls } = scripted(() => ({ status: 401 }));
    const costs = new OpenRouterCosts({ apiKey: "k", fetch, lookupDelaysMs: [0, 0] });
    expect(await costs.generationCost("gen-1")).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("abandons a pending lookup on stop, so shutdown does not wait out retries", async () => {
    const { fetch } = scripted(() => ({ status: 404 }));
    const costs = new OpenRouterCosts({ apiKey: "k", fetch, lookupDelaysMs: [60_000] });
    const pending = costs.generationCost("gen-1");
    await new Promise((r) => setTimeout(r, 10));
    costs.stop();
    expect(await pending).toBeNull();
  });

  it("sums a run's turns, once each, and counts the ones that never resolved", async () => {
    const { fetch, calls } = scripted((url) =>
      url.includes("gen-bad")
        ? { status: 500 }
        : { status: 200, body: { data: { total_cost: 0.01 } } },
    );
    const billing = new RunBilling(new OpenRouterCosts({ apiKey: "k", fetch, lookupDelaysMs: [] }));
    billing.track("gen-a");
    billing.track("gen-a");
    billing.track("gen-b");
    billing.track("gen-bad");
    billing.track(undefined);
    const billed = (await billing.settle())!;
    expect(billed.total).toBeCloseTo(0.02, 10);
    expect(billed).toMatchObject({ turns: 3, resolved: 2 });
    expect(calls).toHaveLength(3);
  });

  it("reports nothing rather than $0 when there was nothing to look up", async () => {
    const billing = new RunBilling(new OpenRouterCosts({ apiKey: "" }));
    billing.track("gen-a"); // no key: /generation is authenticated, so no lookup
    expect(await billing.settle()).toBeNull();
  });
});
