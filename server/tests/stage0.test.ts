/**
 * Stage 0 — the filters, the growth maths, and the MRR judgement.
 *
 * The weight here is on the three places the shell pipeline this replaces was
 * wrong (`stage0.ts` module note): unsorted history, `marketCountries` letting
 * non-big-five shops through, and Trustpilot's missing-is-not-failing rule.
 * Each has a test that fails if the correction is reverted.
 */

import { describe, expect, it } from "vitest";

import {
  buildMrrInstructions,
  parseMrrVerdicts,
  type MrrCandidate,
} from "../src/mrr-prompt.js";
import {
  applyFreeGates,
  countUps,
  growthRatio,
  passesTrustpilot,
  prevPeriod,
  productCandidates,
  roundingBounds,
  runStageZero,
  scoreMrr,
  stageZeroParamsSchema,
  tMinus6,
  topMarket,
  trafficSeries,
  type ShopCandidate,
} from "../src/stage0.js";
import { emptyLedger, type ShopDetail, type ShopSummary, type TrendTrackClient } from "../src/trendtrack.js";

const PARAMS = stageZeroParamsSchema.parse({});

/**
 * A rising six-month series. Offset so two fixtures never share a fingerprint
 * by accident — the mirror-domain dedupe treats an identical series as the same
 * business, and real shops do not have identical absolute visit counts.
 */
function rising(offset = 0): Array<{ period: string; value: number }> {
  const values = [30000, 40000, 50000, 60000, 70000, 90000];
  const periods = [
    "2026-03-01",
    "2026-04-01",
    "2026-05-01",
    "2026-06-01",
    "2026-07-01",
    "2026-08-01",
  ];
  return values.map((value, i) => ({ period: periods[i]!, value: value + offset }));
}

/** A row that passes every gate, so a test can break exactly one thing. */
function shop(overrides: Partial<ShopSummary> = {}): ShopSummary {
  return {
    id: overrides.id ?? "shop-1",
    domain: overrides.domain ?? "goodshop.com",
    name: "Good Shop",
    createdAt: "2023-01-01T00:00:00.000Z",
    traffic: {
      monthlyVisits: 90000,
      growth30d: 0.2,
      history: rising(),
      topCountries: [
        { countryCode: "US", share: 0.7 },
        { countryCode: "CA", share: 0.1 },
      ],
    },
    advertising: { activeAds: 40 },
    catalog: {
      productsCount: 60,
      mainCategory: "Health",
      bestSellers: [{ title: "Daily Greens Powder", price: 39, currency: "USD" }],
    },
    profile: { countryCode: "US", currency: "USD" },
    ...overrides,
  };
}

function detail(overrides: Partial<ShopDetail> = {}): ShopDetail {
  const base = shop();
  return {
    ...base,
    trustpilot: { rating: 4.2, reviewCount: 500 },
    traffic: { ...base.traffic!, growth90d: 0.8, growth180d: 2.0 },
    ...overrides,
  };
}

/** A client whose responses are fixtures. Ledger behaves like the real one. */
function fakeClient(options: {
  pages: ShopSummary[][];
  details?: Record<string, ShopDetail>;
  failDetailFor?: Set<string>;
}): TrendTrackClient & { queries: number } {
  const ledger = emptyLedger();
  let queries = 0;
  return {
    ledger,
    get queries() {
      return queries;
    },
    async queryShops(query) {
      const page = options.pages[queries] ?? [];
      queries += 1;
      ledger.rows += page.length;
      return {
        data: page,
        pagination: {
          limit: query.limit ?? 100,
          offset: query.offset ?? 0,
          total: options.pages.reduce((n, p) => n + p.length, 0),
        },
      };
    },
    async getShop(shopId) {
      if (options.failDetailFor?.has(shopId)) throw new Error("502 upstream");
      ledger.details += 1;
      return options.details?.[shopId] ?? detail({ id: shopId });
    },
    async getUsage() {
      return { remaining: 9000, limit: 10000, used: 1000 };
    },
  };
}

describe("traffic series", () => {
  it("sorts history by period rather than trusting wire order", () => {
    // The shell pipeline read `[.traffic.history[].value]` as-is. Reversed here:
    // unsorted, the ratio inverts and the fastest-shrinking shops rank first.
    const reversed = shop({
      traffic: {
        monthlyVisits: 90000,
        growth30d: 0.2,
        topCountries: [{ countryCode: "US", share: 0.9 }],
        history: [
          { period: "2026-08-01", value: 90000 },
          { period: "2026-07-01", value: 70000 },
          { period: "2026-06-01", value: 60000 },
          { period: "2026-05-01", value: 50000 },
          { period: "2026-04-01", value: 40000 },
          { period: "2026-03-01", value: 30000 },
        ],
      },
    });
    expect(trafficSeries(reversed)).toEqual([30000, 40000, 50000, 60000, 70000, 90000]);
    expect(growthRatio(trafficSeries(reversed))).toBe(3);
    expect(countUps(trafficSeries(reversed))).toBe(5);
  });

  it("counts only months that rose", () => {
    expect(countUps([10, 20, 15, 30, 30, 40])).toBe(3);
  });

  it("refuses a ratio against a zero baseline", () => {
    // jq substituted 1 for a zero baseline, which turns 40,000 visits into a
    // ratio of 40,000 and ranks a dead shop first.
    expect(growthRatio([0, 100, 200])).toBeNull();
    expect(growthRatio([])).toBeNull();
  });
});

describe("free gates", () => {
  it("drops a shop whose main market is outside the big five", () => {
    // Measured 2026-09-12: `marketCountries` returned chiikawamarket.jp (JP 57%,
    // US 7%) for a big-five query. The client-side check is what catches it.
    const japanese = shop({
      id: "jp",
      domain: "chiikawamarket.jp",
      traffic: {
        ...shop().traffic!,
        topCountries: [
          { countryCode: "JP", share: 0.57 },
          { countryCode: "US", share: 0.07 },
        ],
      },
    });
    const { kept, funnel } = applyFreeGates([shop(), japanese], PARAMS);
    expect(funnel.afterBaseline).toBe(2);
    expect(funnel.afterBigFive).toBe(1);
    expect(kept.map((r) => r.shop.domain)).toEqual(["goodshop.com"]);
  });

  it("keeps a shop whose top market is big five even when most traffic is not", () => {
    const thin = shop({
      id: "thin",
      traffic: {
        ...shop().traffic!,
        topCountries: [
          { countryCode: "GB", share: 0.2 },
          { countryCode: "DE", share: 0.19 },
        ],
      },
    });
    const { kept } = applyFreeGates([thin], PARAMS);
    expect(kept).toHaveLength(1);
    expect(topMarket(thin).code).toBe("GB");
  });

  it("drops tiny baselines that only look explosive", () => {
    const tiny = shop({
      id: "tiny",
      traffic: {
        ...shop().traffic!,
        history: [
          { period: "2026-03-01", value: 40 },
          { period: "2026-04-01", value: 80 },
          { period: "2026-05-01", value: 160 },
          { period: "2026-06-01", value: 320 },
          { period: "2026-07-01", value: 640 },
          { period: "2026-08-01", value: 1280 },
        ],
      },
    });
    const { kept, funnel } = applyFreeGates([tiny], PARAMS);
    expect(funnel.afterUps).toBe(1);
    expect(funnel.afterBaseline).toBe(0);
    expect(kept).toHaveLength(0);
  });

  it("drops a shop with fewer than six months of history", () => {
    const short = shop({
      id: "short",
      traffic: {
        ...shop().traffic!,
        history: [
          { period: "2026-06-01", value: 60000 },
          { period: "2026-07-01", value: 70000 },
          { period: "2026-08-01", value: 90000 },
        ],
      },
    });
    expect(applyFreeGates([short], PARAMS).funnel.afterSeries).toBe(0);
  });

  it("dedupes a repeated id, then a mirror domain with an identical series", () => {
    const twin = shop({ id: "shop-2", domain: "goodshop.co.uk" });
    const { funnel } = applyFreeGates([shop(), shop(), twin], PARAMS);
    expect(funnel.returned).toBe(3);
    // The repeated id goes first…
    expect(funnel.afterDuplicates).toBe(2);
    // …and the mirror domain only once the series gates have run.
    expect(funnel.afterMirrors).toBe(1);
  });

  it("does not collapse different shops that share a degenerate series", () => {
    // Deduping by fingerprint before the baseline gate would drop one of these
    // as a mirror of the other. Flat tiny series are common; identical
    // six-figure ones are not.
    const flat = (id: string) =>
      shop({
        id,
        domain: `${id}.com`,
        traffic: {
          ...shop().traffic!,
          history: [
            { period: "2026-03-01", value: 0 },
            { period: "2026-04-01", value: 0 },
            { period: "2026-05-01", value: 0 },
            { period: "2026-06-01", value: 0 },
            { period: "2026-07-01", value: 0 },
            { period: "2026-08-01", value: 0 },
          ],
        },
      });
    const { funnel } = applyFreeGates([flat("a"), flat("b")], PARAMS);
    expect(funnel.afterDuplicates).toBe(2);
    // Both are then dropped on their own merits — no ups, no baseline — rather
    // than one being silently mistaken for the other.
    expect(funnel.afterUps).toBe(0);
  });

  it("ranks survivors by ratio, descending", () => {
    const faster = shop({
      id: "fast",
      domain: "faster.com",
      traffic: {
        ...shop().traffic!,
        history: [
          { period: "2026-03-01", value: 20000 },
          { period: "2026-04-01", value: 40000 },
          { period: "2026-05-01", value: 60000 },
          { period: "2026-06-01", value: 80000 },
          { period: "2026-07-01", value: 120000 },
          { period: "2026-08-01", value: 200000 },
        ],
      },
    });
    // 10× versus 3×.
    const { kept } = applyFreeGates([shop(), faster], PARAMS);
    expect(kept.map((r) => r.shop.domain)).toEqual(["faster.com", "goodshop.com"]);
  });
});

describe("trustpilot", () => {
  it("keeps a shop with no Trustpilot profile", () => {
    // Missing means "not measured". Treating it as zero reads as "rated badly"
    // and would drop every shop that never set Trustpilot up.
    expect(passesTrustpilot({ trustpilot: null }, 3)).toBe(true);
    expect(passesTrustpilot({ trustpilot: { rating: null, reviewCount: null } }, 3)).toBe(true);
  });

  it("drops a shop rated below the floor and keeps one exactly on it", () => {
    expect(passesTrustpilot({ trustpilot: { rating: 2.9, reviewCount: 10 } }, 3)).toBe(false);
    expect(passesTrustpilot({ trustpilot: { rating: 3, reviewCount: 10 } }, 3)).toBe(true);
  });
});

describe("t-6 reconstruction", () => {
  const series = [30000, 40000, 50000, 60000, 70000, 90000];
  const periods = [
    "2026-03-01",
    "2026-04-01",
    "2026-05-01",
    "2026-06-01",
    "2026-07-01",
    "2026-08-01",
  ];

  it("labels observed months newest-first and appends an estimated t-6", () => {
    const { months } = tMinus6(series, periods, { growth90d: 0.5, growth180d: 2.0 });
    expect(months).toHaveLength(7);
    expect(months[0]).toMatchObject({ label: "t", period: "2026-08-01", visits: 90000, estimated: false });
    expect(months[6]).toMatchObject({ label: "t-6", period: "2026-02-01", estimated: true });
    // 90000 / (1 + 2.0)
    expect(months[6]!.visits).toBe(30000);
    expect(months[6]!.low).toBeLessThan(months[6]!.visits!);
    expect(months[6]!.high).toBeGreaterThan(months[6]!.visits!);
  });

  it("warns when growth90d fits trailing sums better than point-to-point", () => {
    // point-to-point is 90000/60000-1 = 0.5; trailing sums is
    // (90000+70000+60000)/(50000+40000+30000)-1 ≈ 0.833. Reporting the latter
    // means growth180d is not invertible into a single month.
    const { warning } = tMinus6(series, periods, { growth90d: 0.833, growth180d: 2.0 });
    expect(warning).toContain("trailing-sums");
    const clean = tMinus6(series, periods, { growth90d: 0.5, growth180d: 2.0 });
    expect(clean.warning).toBe("");
  });

  it("says so when growth180d is missing rather than inventing a month", () => {
    const { months, warning } = tMinus6(series, periods, { growth90d: 0.5, growth180d: null });
    expect(months).toHaveLength(6);
    expect(warning).toContain("growth180d missing");
  });

  it("widens the estimate by the rounding of growth180d", () => {
    expect(roundingBounds(2.0, 2)).toEqual([1.995, 2.005]);
  });

  it("steps back across a year boundary", () => {
    expect(prevPeriod("2026-01-01")).toBe("2025-12-01");
  });
});

describe("product candidates", () => {
  const candidateShop = (overrides: Partial<ShopCandidate> = {}): ShopCandidate =>
    ({
      id: "s1",
      domain: "goodshop.com",
      category: "Health",
      ...overrides,
    }) as ShopCandidate;

  it("drops titles nothing can be judged from", () => {
    // worldofbooks.com returns three best sellers all titled "!".
    const best = new Map([
      [
        "s1",
        [
          { title: "!", price: 5.49, currency: "GBP" },
          { title: "  ", price: 0, currency: "GBP" },
          { title: "Daily Greens Powder", price: 39, currency: "USD" },
        ],
      ],
    ]);
    const candidates = productCandidates([candidateShop()], best);
    expect(candidates.map((c) => c.title)).toEqual(["Daily Greens Powder"]);
  });

  it("drops things that are not products", () => {
    const best = new Map([
      [
        "s1",
        [
          { title: "10 Year Warranty", price: 24.9, currency: "USD" },
          { title: "TL T-Shirt", price: 29.99, currency: "USD" },
          { title: "Healthy Metal Booklet", price: 0, currency: "USD" },
          { title: "Magnesium Glycinate Capsules", price: 29, currency: "USD" },
        ],
      ],
    ]);
    expect(productCandidates([candidateShop()], best).map((c) => c.title)).toEqual([
      "Magnesium Glycinate Capsules",
    ]);
  });

  it("numbers refs uniquely across shops", () => {
    const best = new Map([
      ["s1", [{ title: "Product One", price: 1, currency: "USD" }]],
      ["s2", [{ title: "Product Two", price: 2, currency: "USD" }]],
    ]);
    const candidates = productCandidates(
      [candidateShop(), candidateShop({ id: "s2", domain: "other.com" })],
      best,
    );
    expect(candidates.map((c) => c.ref)).toEqual([0, 1]);
  });
});

describe("the MRR prompt", () => {
  const candidates: MrrCandidate[] = [
    { ref: 0, domain: "a.com", category: "Health", title: "Daily Greens Powder", price: 39, currency: "USD" },
    { ref: 1, domain: "b.com", category: "Home", title: "Cast Iron Skillet", price: 89, currency: "USD" },
  ];

  it("puts the candidates after the example, not before it", () => {
    // `prompt.ts` put its worked example last and stage-1 runs drifted toward
    // the example's subject whatever was briefed. The data gets the last word.
    const text = buildMrrInstructions(candidates);
    expect(text.indexOf("Daily Greens Powder")).toBeGreaterThan(text.indexOf('"verdicts"'));
    expect(text.lastIndexOf("## The candidates")).toBeGreaterThan(text.indexOf("## Output"));
  });

  it("names no real product in the example", () => {
    const text = buildMrrInstructions([]);
    // The example's refs are negative on purpose so a copied one is obvious.
    expect(text).toContain('"ref": -1');
    expect(text).toContain("**shape only**");
    expect(text).toContain("do not copy any");
  });

  it("says when a price is missing instead of printing a zero", () => {
    const text = buildMrrInstructions([{ ...candidates[0]!, price: 0 }]);
    expect(text).toContain("price unknown");
  });
});

describe("reading the model's verdicts", () => {
  const known = new Set([0, 1, 2]);

  it("takes the last decodable block", () => {
    const output = [
      "Here is a draft:",
      "```json",
      '{"verdicts": [{"ref": 0, "score": 1, "reason": "draft"}]}',
      "```",
      "On reflection:",
      "```json",
      '{"verdicts": [{"ref": 0, "score": 9, "reason": "final"}]}',
      "```",
    ].join("\n");
    const { verdicts } = parseMrrVerdicts(output, known);
    expect(verdicts).toEqual([{ ref: 0, score: 9, reason: "final" }]);
  });

  it("survives a non-JSON block before the real one", () => {
    // A regex scanner treats the python block's closing fence as the JSON
    // block's opening fence and finds nothing. `packet.ts` learned this first.
    const output = [
      "```python",
      "print('thinking')",
      "```",
      "```json",
      '{"verdicts": [{"ref": 1, "score": 7, "reason": "ok"}]}',
      "```",
    ].join("\n");
    expect(parseMrrVerdicts(output, known).verdicts).toEqual([
      { ref: 1, score: 7, reason: "ok" },
    ]);
  });

  it("drops a verdict for a ref it was never given", () => {
    const output = '```json\n{"verdicts": [{"ref": 99, "score": 10, "reason": "invented"}]}\n```';
    const { verdicts, problems } = parseMrrVerdicts(output, known);
    expect(verdicts).toEqual([]);
    expect(problems[0]).toContain("unknown ref");
  });

  it("keeps the first of a duplicated ref", () => {
    const output =
      '```json\n{"verdicts": [{"ref": 0, "score": 8, "reason": "first"},' +
      ' {"ref": 0, "score": 2, "reason": "second"}]}\n```';
    const { verdicts, problems } = parseMrrVerdicts(output, known);
    expect(verdicts).toEqual([{ ref: 0, score: 8, reason: "first" }]);
    expect(problems[0]).toContain("more than once");
  });

  it("clamps and rounds a score rather than rejecting it", () => {
    const output =
      '```json\n{"verdicts": [{"ref": 0, "score": 11, "reason": "x"},' +
      ' {"ref": 1, "score": -4, "reason": "y"}, {"ref": 2, "score": 7.6, "reason": "z"}]}\n```';
    const { verdicts } = parseMrrVerdicts(output, known);
    expect(verdicts.map((v) => v.score)).toEqual([10, 0, 8]);
  });

  it("reports a reply with no JSON at all", () => {
    const { verdicts, problems } = parseMrrVerdicts("I would rather not.", known);
    expect(verdicts).toEqual([]);
    expect(problems[0]).toContain("no block that decoded as JSON");
  });
});

describe("scoring in batches", () => {
  const many: MrrCandidate[] = Array.from({ length: 5 }, (_, i) => ({
    ref: i,
    domain: "a.com",
    category: "Health",
    title: `Product ${i}`,
    price: 10,
    currency: "USD",
  }));

  it("keeps the batches that worked when one fails every attempt", async () => {
    // Batch 2 fails all three attempts; batches 1 and 3 still land.
    let batch = 0;
    const ask = async (_s: string, instructions: string) => {
      const refs = [...instructions.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
      if (refs.includes(2)) throw new Error("model unavailable");
      batch += 1;
      return `\`\`\`json\n${JSON.stringify({
        verdicts: refs.map((ref) => ({ ref, score: 5, reason: "ok" })),
      })}\n\`\`\``;
    };
    const { scores, problems } = await scoreMrr(many, ask, 2);
    expect(batch).toBe(2);
    expect(scores.size).toBe(3);
    expect(problems.some((p) => p.includes("batch 2 failed"))).toBe(true);
  });

  it("retries a transient failure rather than losing the batch", async () => {
    // A live run lost all 24 candidates to one `Connection error.`; the same
    // run a minute later scored 24 of 24.
    let attempts = 0;
    const ask = async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("Connection error.");
      return '```json\n{"verdicts": [{"ref": 0, "score": 9, "reason": "monthly"}]}\n```';
    };
    const { scores, problems } = await scoreMrr(many.slice(0, 1), ask, 1);
    expect(attempts).toBe(3);
    expect(scores.get(0)).toMatchObject({ score: 9 });
    expect(problems).toEqual([]);
  });

  it("reports unscored candidates instead of defaulting them to zero", async () => {
    // Zero means "durable" in this rubric. Defaulting a silence to zero would
    // rank an unmeasured product as confidently bad.
    const ask = async () =>
      '```json\n{"verdicts": [{"ref": 0, "score": 9, "reason": "monthly"}]}\n```';
    const { scores, problems } = await scoreMrr(many.slice(0, 3), ask, 3);
    expect(scores.size).toBe(1);
    expect(scores.has(1)).toBe(false);
    expect(problems.some((p) => p.includes("went unscored"))).toBe(true);
  });
});

describe("the whole pipeline", () => {
  it("ranks products by score and reports the funnel and the bill", async () => {
    const good = shop({ id: "s1", domain: "greens.com" });
    const durable = shop({
      id: "s2",
      domain: "skillets.com",
      traffic: { ...shop().traffic!, history: rising(1000) },
      catalog: {
        productsCount: 30,
        mainCategory: "Home",
        bestSellers: [{ title: "Cast Iron Skillet", price: 89, currency: "USD" }],
      },
    });
    const japanese = shop({
      id: "s3",
      domain: "tokyo.jp",
      traffic: {
        ...shop().traffic!,
        history: rising(2000),
        topCountries: [{ countryCode: "JP", share: 0.9 }],
      },
    });
    const badlyRated = shop({
      id: "s4",
      domain: "onestar.com",
      traffic: { ...shop().traffic!, history: rising(3000) },
    });

    const client = fakeClient({
      pages: [[good, durable, japanese, badlyRated]],
      details: {
        s1: detail({ id: "s1" }),
        s2: detail({ id: "s2" }),
        s4: detail({ id: "s4", trustpilot: { rating: 1.4, reviewCount: 900 } }),
      },
    });

    const ask = async (_system: string, instructions: string) => {
      // Score by what is actually in the prompt, so a prompt that lost its
      // candidates fails this test rather than passing with fabricated refs.
      const verdicts: unknown[] = [];
      for (const line of instructions.split("\n")) {
        const m = /^(\d+)\. (.+)$/.exec(line.trim());
        if (!m) continue;
        const consumable = /powder|greens/i.test(m[2]!);
        verdicts.push({
          ref: Number(m[1]),
          score: consumable ? 9 : 1,
          reason: consumable ? "depletes monthly" : "durable",
        });
      }
      return `\`\`\`json\n${JSON.stringify({ verdicts })}\n\`\`\``;
    };

    const result = await runStageZero({ client, params: PARAMS, ask });

    expect(result.funnel).toMatchObject({
      returned: 4,
      afterDuplicates: 4,
      afterSeries: 4,
      afterUps: 4,
      afterBaseline: 4,
      afterMirrors: 4,
      // tokyo.jp dropped by the market gate.
      afterBigFive: 3,
      // onestar.com dropped by Trustpilot.
      afterTrustpilot: 2,
      productsConsidered: 2,
      productsScored: 2,
    });

    expect(result.products.map((p) => p.title)).toEqual([
      "Daily Greens Powder",
      "Cast Iron Skillet",
    ]);
    expect(result.products[0]!.score).toBe(9);
    expect(result.shops.map((s) => s.domain)).toEqual(["greens.com", "skillets.com"]);
    expect(result.shops[0]!.mrrScore).toBe(9);

    // 4 rows + 3 detail calls; tokyo.jp never got one, because the free gates
    // run before the paid one.
    expect(result.credits).toMatchObject({ rows: 4, details: 3, total: 7 });
    expect(result.problems).toEqual([]);
  });

  it("keeps a shop whose detail call failed, with its ratings unknown", async () => {
    const client = fakeClient({
      pages: [[shop({ id: "s1", domain: "greens.com" })]],
      failDetailFor: new Set(["s1"]),
    });
    const ask = async () =>
      '```json\n{"verdicts": [{"ref": 0, "score": 8, "reason": "consumable"}]}\n```';

    const result = await runStageZero({ client, params: PARAMS, ask });

    // A network error is not evidence of a bad rating, so the shop survives —
    // but nothing is invented for it.
    expect(result.shops).toHaveLength(1);
    expect(result.shops[0]!.trustpilotRating).toBeNull();
    expect(result.shops[0]!.growth180d).toBeNull();
    expect(result.shops[0]!.months).toEqual([]);
    expect(result.shops[0]!.tMinus6Warning).toContain("detail call failed");
    expect(result.problems[0]).toContain("detail call failed");
  });

  it("stops paging when a page comes back short", async () => {
    const client = fakeClient({ pages: [[shop({ id: "s1" })]] });
    await runStageZero({ client, params: stageZeroParamsSchema.parse({ pages: 5 }), ask: async () => "" });
    // One short page, so four pages of credits were never spent.
    expect(client.queries).toBe(1);
  });

  it("scores nothing and reports it when every title is unusable", async () => {
    const junk = shop({
      id: "s1",
      catalog: { productsCount: 25000, mainCategory: "Books", bestSellers: [{ title: "!", price: 0, currency: "GBP" }] },
    });
    let asked = 0;
    const result = await runStageZero({
      client: fakeClient({ pages: [[junk]] }),
      params: PARAMS,
      ask: async () => {
        asked += 1;
        return "";
      },
    });
    expect(result.funnel.productsConsidered).toBe(0);
    expect(result.products).toEqual([]);
    expect(result.shops[0]!.mrrScore).toBeNull();
    // No candidates means no LLM call at all.
    expect(asked).toBe(0);
  });
});
