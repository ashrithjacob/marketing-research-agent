/**
 * The TrendTrack response cache.
 *
 * The point of the cache is that tuning a *free* gate does not re-buy rows, so
 * most of these tests are about which parameter changes are supposed to cost
 * money and which are not. Getting that split wrong is silent: the run still
 * works, it just bills 500 credits it did not need to.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runStageZero, stageZeroParamsSchema } from "../src/stage0.js";
import { SqliteResearchStore } from "../src/store.js";
import { CachedTrendTrackClient, canonicalKey } from "../src/trendtrack-cache.js";
import { emptyLedger, type ShopQuery, type TrendTrackClient } from "../src/trendtrack.js";

let store: SqliteResearchStore;

beforeEach(() => {
  store = new SqliteResearchStore(":memory:");
});

afterEach(() => {
  store.close();
  vi.useRealTimers();
});

const WEEK = 7 * 86400;

/** `offset` keeps two shops' series distinct, or the mirror-domain dedupe
 *  correctly treats them as one business. */
function shopRow(id: string, offset = 0) {
  return {
    id,
    domain: `${id}.com`,
    name: id,
    traffic: {
      monthlyVisits: 90000 + offset,
      growth30d: 0.2,
      history: [30000, 40000, 50000, 60000, 70000, 90000].map((value, i) => ({
        period: `2026-0${i + 3}-01`,
        value: value + offset,
      })),
      topCountries: [{ countryCode: "US", share: 0.8 }],
    },
    advertising: { activeAds: 30 },
    catalog: {
      productsCount: 40,
      mainCategory: "Health",
      bestSellers: [{ title: "Daily Greens Powder", price: 39, currency: "USD" }],
    },
    profile: { countryCode: "US", currency: "USD" },
  };
}

/**
 * Counts what actually reached the network.
 *
 * `state` is shared across clients so the counters survive a second run, while
 * each client gets its own ledger — which is how production behaves, since
 * `DiscoverySupervisor` builds a fresh client per run.
 */
function counting(state = { queries: 0, details: 0 }): TrendTrackClient & {
  queries: number;
  details: number;
} {
  const ledger = emptyLedger();
  return {
    ledger,
    get queries() {
      return state.queries;
    },
    get details() {
      return state.details;
    },
    async queryShops(query: ShopQuery) {
      state.queries += 1;
      const data = [shopRow("s1"), shopRow("s2", 1000)];
      ledger.rows += data.length;
      return { data, pagination: { limit: query.limit ?? 100, offset: 0, total: 2 } };
    },
    async getShop(shopId: string) {
      state.details += 1;
      ledger.details += 1;
      return {
        ...shopRow(shopId),
        trustpilot: { rating: 4.5, reviewCount: 100 },
        traffic: { ...shopRow(shopId).traffic, growth90d: 0.8, growth180d: 2 },
      };
    },
    async getUsage() {
      return { remaining: 9000, limit: 10000, used: 1000 };
    },
  };
}

const wrap = (delegate: TrendTrackClient, maxAgeSeconds = WEEK) =>
  new CachedTrendTrackClient({ delegate, store, maxAgeSeconds });

describe("the cache key", () => {
  it("ignores the order object keys were written in", () => {
    expect(canonicalKey("query", { a: 1, b: 2 })).toBe(canonicalKey("query", { b: 2, a: 1 }));
  });

  it("treats an absent filter and a null one as the same request", () => {
    expect(canonicalKey("query", { a: 1 })).toBe(canonicalKey("query", { a: 1, b: null }));
    expect(canonicalKey("query", { a: 1 })).toBe(canonicalKey("query", { a: 1, b: undefined }));
  });

  it("keeps array order, because growth conditions are a sequence", () => {
    // `trafficGrowth` entries are joined by `operator`, so reordering them
    // changes the query and must not hit the same entry.
    const a = { trafficGrowth: [{ period: "last180d" }, { period: "last90d" }] };
    const b = { trafficGrowth: [{ period: "last90d" }, { period: "last180d" }] };
    expect(canonicalKey("query", a)).not.toBe(canonicalKey("query", b));
  });

  it("separates a query from a shop", () => {
    expect(canonicalKey("query", { id: "x" })).not.toBe(canonicalKey("shop", { id: "x" }));
  });

  it("distinguishes pages of the same search", () => {
    expect(canonicalKey("query", { offset: 0 })).not.toBe(canonicalKey("query", { offset: 100 }));
  });
});

describe("serving from cache", () => {
  it("bills the first call and nothing for the second", async () => {
    const net = { queries: 0, details: 0 };
    const first = wrap(counting(net));
    await first.queryShops({ limit: 100 });
    expect(net.queries).toBe(1);
    expect(first.ledger.rows).toBe(2);

    // A second run is a fresh client over the same store, as in production.
    const second = wrap(counting(net));
    await second.queryShops({ limit: 100 });
    expect(net.queries).toBe(1);
    expect(second.ledger.rows).toBe(0);
    expect(second.cache).toMatchObject({ hits: 1, misses: 0, creditsSaved: 2 });
  });

  it("reuses a shop across different searches", async () => {
    const net = { queries: 0, details: 0 };
    await wrap(counting(net)).getShop("s1");
    await wrap(counting(net)).getShop("s1");
    expect(net.details).toBe(1);
  });

  it("refetches once past the TTL, and says the entry was stale", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    const net = { queries: 0, details: 0 };
    await wrap(counting(net)).getShop("s1");

    vi.setSystemTime(new Date("2026-09-06T00:00:00Z")); // 5 days: still good
    const withinTtl = wrap(counting(net));
    await withinTtl.getShop("s1");
    expect(net.details).toBe(1);
    expect(withinTtl.cache.hits).toBe(1);

    vi.setSystemTime(new Date("2026-09-09T00:00:01Z")); // 8 days: expired
    const pastTtl = wrap(counting(net));
    await pastTtl.getShop("s1");
    expect(net.details).toBe(2);
    expect(pastTtl.cache).toMatchObject({ stale: 1, hits: 0, misses: 1 });
  });

  it("reports how stale the oldest reused response was", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    await wrap(counting()).getShop("s1");
    vi.setSystemTime(new Date("2026-09-04T00:00:00Z"));
    const later = wrap(counting());
    await later.getShop("s1");
    expect(later.cache.oldestUsedSeconds).toBeCloseTo(3 * 86400, 0);
  });

  it("never caches usage, which exists to be current", async () => {
    const net = counting();
    const client = wrap(net);
    await client.getUsage();
    await client.getUsage();
    expect(store.cacheStats().entries).toBe(0);
  });

  it("does nothing at all when disabled", async () => {
    const net = { queries: 0, details: 0 };
    const off = wrap(counting(net), 0);
    expect(off.enabled).toBe(false);
    await off.queryShops({ limit: 100 });
    await off.queryShops({ limit: 100 });
    expect(net.queries).toBe(2);
    expect(store.cacheStats().entries).toBe(0);
  });

  it("still returns the response when the cache cannot be written", async () => {
    const broken = Object.create(store) as SqliteResearchStore;
    (broken as any).putCached = () => {
      throw new Error("disk full");
    };
    const client = new CachedTrendTrackClient({
      delegate: counting(),
      store: broken,
      maxAgeSeconds: WEEK,
    });
    // Already paid for and in hand; a cache that cannot write is a slow cache.
    await expect(client.queryShops({ limit: 100 })).resolves.toMatchObject({
      data: expect.any(Array),
    });
  });
});

describe("which parameters cost money", () => {
  const run = (client: TrendTrackClient, overrides: Record<string, unknown>) =>
    runStageZero({
      client,
      params: stageZeroParamsSchema.parse({ pages: 1, ...overrides }),
      ask: async () =>
        '```json\n{"verdicts":[{"ref":0,"score":9,"reason":"x"},{"ref":1,"score":9,"reason":"x"}]}\n```',
    });

  it("does not re-buy rows when only a client-side gate changes", async () => {
    const net = { queries: 0, details: 0 };
    await run(wrap(counting(net)), {});
    const spent = { queries: net.queries, details: net.details };

    // Every one of these is applied to rows already bought.
    for (const change of [
      { minUps: 3 },
      { minBaseline: 30000 },
      { minTrustpilotRating: 4 },
      { mrrBatchSize: 10 },
      { model: "some/other-model" },
    ]) {
      const second = await run(wrap(counting(net)), change);
      expect(second.cache!.hits).toBeGreaterThan(0);
    }
    expect(net.queries).toBe(spent.queries);
    expect(net.details).toBe(spent.details);
  });

  it("buys new rows when a server-side filter changes", async () => {
    const net = { queries: 0, details: 0 };
    await run(wrap(counting(net)), {});
    expect(net.queries).toBe(1);
    // This one goes into the query body, so it is a different request.
    await run(wrap(counting(net)), { minMonthlyVisits: 10000 });
    expect(net.queries).toBe(2);
  });

  it("reports the cache alongside the bill, and null when off", async () => {
    const net = { queries: 0, details: 0 };
    const cached = await run(wrap(counting(net)), {});
    expect(cached.cache).toMatchObject({ maxAgeDays: 7, misses: expect.any(Number) });
    const uncached = await run(wrap(counting(net), 0), {});
    expect(uncached.cache).toBeNull();
  });

  it("charges nothing at all for a fully cached rerun", async () => {
    const net = { queries: 0, details: 0 };
    await run(wrap(counting(net)), {});
    const second = await run(wrap(counting(net)), {});
    expect(second.credits).toMatchObject({ rows: 0, details: 0, total: 0 });
    expect(second.cache!.creditsSaved).toBeGreaterThan(0);
    // And the answer is the same one.
    expect(second.products.map((p) => p.title)).toEqual(["Daily Greens Powder", "Daily Greens Powder"]);
  });
});

describe("housekeeping", () => {
  it("counts what it holds, by kind", async () => {
    const net = counting();
    const client = wrap(net);
    await client.queryShops({ limit: 100 });
    await client.getShop("s1");
    expect(store.cacheStats()).toMatchObject({ entries: 2, queries: 1, shops: 1, creditsStored: 3 });
  });

  it("prunes only what is past the TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    await wrap(counting()).getShop("old");
    vi.setSystemTime(new Date("2026-09-10T00:00:00Z"));
    await wrap(counting()).getShop("new");

    expect(store.pruneCache(WEEK)).toBe(1);
    expect(store.cacheStats().entries).toBe(1);
    expect(store.getCached("shop:new")).not.toBeNull();
  });

  it("replaces a stale entry rather than keeping its timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    store.putCached({ key: "shop:s1", kind: "shop", payload: { v: 1 }, credits: 1 });
    vi.setSystemTime(new Date("2026-09-20T00:00:00Z"));
    store.putCached({ key: "shop:s1", kind: "shop", payload: { v: 2 }, credits: 1 });

    const hit = store.getCached("shop:s1")!;
    expect(hit.payload).toEqual({ v: 2 });
    // A refetch that kept the old timestamp would expire again immediately.
    expect(hit.ageSeconds).toBeLessThan(60);
    expect(store.cacheStats().entries).toBe(1);
  });

  it("empties on request and says what has to be re-bought", async () => {
    const client = wrap(counting());
    await client.queryShops({ limit: 100 });
    const before = store.cacheStats();
    expect(store.clearCache()).toBe(before.entries);
    expect(store.cacheStats().entries).toBe(0);
  });
});
