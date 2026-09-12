/**
 * The TrendTrack adapter: billing, and the 429 asymmetry.
 *
 * The retry rules here were written against a real 429. A live stage-0 run on
 * 2026-09-12 lost three of seven detail calls to
 * "Too many concurrent public API requests are already in flight", and the fix
 * has two halves: a smaller pool (`DETAIL_CONCURRENCY`) and a retry that applies
 * to detail calls but deliberately not to searches.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpTrendTrackClient, TrendTrackError, ledgerTotal } from "../src/trendtrack.js";

const original = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = original;
  vi.useRealTimers();
});

/** Queue of responses, one per call, so a test can script a 429 then a 200. */
function stubFetch(responses: Array<{ status: number; body: unknown }>): { calls: number } {
  const state = { calls: 0 };
  globalThis.fetch = (async () => {
    const next = responses[Math.min(state.calls, responses.length - 1)]!;
    state.calls += 1;
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return state;
}

const client = () => new HttpTrendTrackClient({ apiKey: "k", timeoutSeconds: 5 });

describe("billing", () => {
  it("charges one credit per returned row, not per call", async () => {
    stubFetch([
      {
        status: 200,
        body: { data: [{ id: "a" }, { id: "b" }, { id: "c" }], pagination: { limit: 100, offset: 0, total: 3 } },
      },
    ]);
    const c = client();
    await c.queryShops({ limit: 100 });
    expect(c.ledger.rows).toBe(3);
    expect(ledgerTotal(c.ledger)).toBe(3);
  });

  it("charges a flat credit for a detail call", async () => {
    stubFetch([{ status: 200, body: { data: { id: "a", domain: "a.com" } } }]);
    const c = client();
    await c.getShop("a");
    expect(c.ledger).toMatchObject({ rows: 0, details: 1 });
  });

  it("charges nothing for a call that failed", async () => {
    stubFetch([{ status: 500, body: { error: { message: "boom" } } }]);
    const c = client();
    await expect(c.getShop("a")).rejects.toThrow(TrendTrackError);
    expect(ledgerTotal(c.ledger)).toBe(0);
  });

  it("counts usage as free", async () => {
    stubFetch([
      {
        status: 200,
        body: {
          includedQuota: { limit: 10000, used: 240, remaining: 9760 },
          credits: { totalRemaining: 9760 },
        },
      },
    ]);
    const c = client();
    expect(await c.getUsage()).toMatchObject({ remaining: 9760, used: 240 });
    expect(ledgerTotal(c.ledger)).toBe(0);
    expect(c.ledger.free).toBe(1);
  });

  it("prefers totalRemaining, which includes purchased top-ups", async () => {
    stubFetch([
      {
        status: 200,
        body: {
          includedQuota: { limit: 10000, used: 10000, remaining: 0 },
          credits: { totalRemaining: 500 },
        },
      },
    ]);
    // The quota block alone would say zero and stop a run that can still pay.
    expect((await client().getUsage()).remaining).toBe(500);
  });
});

describe("429 handling", () => {
  it("retries a refused detail call and succeeds", async () => {
    vi.useFakeTimers();
    const state = stubFetch([
      { status: 429, body: { error: { message: "Too many concurrent public API requests" } } },
      { status: 200, body: { data: { id: "a", domain: "a.com" } } },
    ]);
    const c = client();
    const pending = c.getShop("a");
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({ domain: "a.com" });
    expect(state.calls).toBe(2);
    // Charged once, for the call that actually returned data.
    expect(c.ledger.details).toBe(1);
  });

  it("gives up after a bounded number of attempts", async () => {
    vi.useFakeTimers();
    const state = stubFetch([{ status: 429, body: { error: { message: "slow down" } } }]);
    const c = client();
    const pending = c.getShop("a");
    const assertion = expect(pending).rejects.toThrow(/429/);
    await vi.runAllTimersAsync();
    await assertion;
    expect(state.calls).toBe(4);
    expect(c.ledger.details).toBe(0);
  });

  it("does not retry a search, because a retried page is billed twice", async () => {
    const state = stubFetch([{ status: 429, body: { error: { message: "slow down" } } }]);
    await expect(client().queryShops({ limit: 100 })).rejects.toThrow(/429/);
    expect(state.calls).toBe(1);
  });

  it("does not retry an error that is not a 429", async () => {
    const state = stubFetch([{ status: 500, body: { error: { message: "boom" } } }]);
    await expect(client().getShop("a")).rejects.toThrow(/500/);
    expect(state.calls).toBe(1);
  });
});

describe("failure reporting", () => {
  it("refuses to call at all without a key", async () => {
    const state = stubFetch([{ status: 200, body: {} }]);
    await expect(
      new HttpTrendTrackClient({ apiKey: "" }).queryShops({}),
    ).rejects.toThrow(/TRENDTRACK_API_KEY/);
    expect(state.calls).toBe(0);
  });

  it("carries the upstream message into the error", async () => {
    stubFetch([{ status: 422, body: { error: { message: "sortBy must be one of…" } } }]);
    await expect(client().queryShops({ sortBy: "revenue" })).rejects.toThrow(/sortBy must be/);
  });

  it("reports a body that is not JSON rather than returning undefined", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>gateway</html>", { status: 200 })) as typeof fetch;
    await expect(client().getShop("a")).rejects.toThrow(/not JSON/);
  });
});
