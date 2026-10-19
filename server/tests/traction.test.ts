/** Shop traction from TrendTrack, shaped as measured on 2026-10-19: a free lookup by exact domain before the user chooses, then each confirmed shop's sales and the product's best-seller rank, charged to the run. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ServiceClients, TrendtrackShops } from "../src/adapters/index.js";
import { Pipeline, ProductMarketStage, ShopTractionCollector } from "../src/agent/index.js";
import type { Competitor, Product, ShopIntel, ShopSignals, ShopTraction } from "../src/domain/index.js";
import { App } from "../src/http/index.js";

import { Faux, FakeVisuals, FakeWeb, NoBilling, TestSettings } from "./fakes.js";
import { BRIEF, DROPS_URL, GUMMIES_URL, PAGES, PRODUCT_URL, Profiles, RESOLUTION, SEARCH_HITS, TEA_URL } from "./mullevia.js";
import { PostgresStores } from "./postgres-stores.js";
import { RunDriver } from "./run-driver.js";
import { ScriptedAgents } from "./scripted-agents.js";

const json = (body: unknown, credits = 0) => new Response(JSON.stringify(body), { status: 200, headers: { "x-credits-used": String(credits) } });
const { settings } = TestSettings.make({ trendtrackApiKey: "tt-test", trendtrackBaseUrl: "https://trendtrack.test" });

afterEach(() => vi.unstubAllGlobals());

describe("TrendTrack shops", () => {
  it("finds a shop only by an exact domain match, and reads its signals", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ data: [{ matchType: "exact", matchField: "domain", shop: { id: "s1" }, signals: { monthlyVisits: 118945, activeAds: 43 } }] })));
    expect(await new TrendtrackShops(settings).lookup("trybetterbrand.com")).toEqual({ domain: "trybetterbrand.com", shop_id: "s1", monthly_visits: 118945, active_ads: 43 });
    vi.stubGlobal("fetch", vi.fn(async () => json({ data: [{ matchType: "fuzzy", matchField: "name", shop: { id: "s2" } }] })));
    expect(await new TrendtrackShops(settings).lookup("betterbrand")).toBeNull();
  });

  it("gives shop-wide sales and the product's best-seller rank, matching an encoded handle, and counts the credits each call reports", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes("/products?")
        ? json({ data: [{ handle: "betterlungs-tea", rank: 2 }, { handle: "betterlungs®-mullein-chlorophyll", rank: 1 }] }, 4)
        : json({ data: { catalog: { productsCount: 23 }, sales: { estMonthlySales: 52737, estMonthlySalesMin: 37819, estMonthlySalesMax: 67525, unitsSold: 1573 }, traffic: { monthlyVisits: 118945, growth30d: 0.64 }, advertising: { activeAds: 44 } } }, 4),
    );
    vi.stubGlobal("fetch", fetch);
    const { traction, credits } = await new TrendtrackShops(settings).traction({ domain: "trybetterbrand.com", shop_id: "s1", monthly_visits: 1, active_ads: 1 }, "betterlungs®-mullein-chlorophyll");
    expect(credits).toBe(8);
    expect(traction).toMatchObject({ monthly_sales_usd: 52737, monthly_sales_min_usd: 37819, units_sold: 1573, products_count: 23, product_rank: 1, ranked_within: 2, single_product: false, active_ads: 44 });
    expect(String(fetch.mock.calls[1]![0])).toContain("sortBy=popularity");
  });

  it("says the rank is unknown, not low, when TrendTrack lists no best-sellers for a shop (Mullevia, 2026-10-19)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("/products?") ? json({ data: [], pagination: { total: 0 } }, 4) : json({ data: { catalog: { productsCount: 6 }, sales: { estMonthlySales: 48658 } } }, 4))));
    const { traction } = await new TrendtrackShops(settings).traction({ domain: "mullevia.com", shop_id: "m", monthly_visits: 7629, active_ads: 0 }, "mullevia-mullein-drops");
    expect(traction).toMatchObject({ products_count: 6, product_rank: null, ranked_within: 0 });
  });

  it("treats a one-product shop's sales as the product's, without paying for its product list", async () => {
    const fetch = vi.fn(async () => json({ data: { catalog: { productsCount: 1 }, sales: { estMonthlySales: 9000, unitsSold: 300 } } }, 4));
    vi.stubGlobal("fetch", fetch);
    const { traction } = await new TrendtrackShops(settings).traction({ domain: "one.com", shop_id: "s9", monthly_visits: null, active_ads: null }, "drops");
    expect(traction).toMatchObject({ single_product: true, product_rank: 1, ranked_within: 1, monthly_sales_usd: 9000 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

class FakeShops implements ShopIntel {
  readonly looked: string[] = [];

  async lookup(domain: string): Promise<ShopSignals | null> {
    this.looked.push(domain);
    return { domain, shop_id: `shop-${domain}`, monthly_visits: domain.length * 1000, active_ads: 3 };
  }

  async traction(signals: ShopSignals, handle: string | null): Promise<{ traction: ShopTraction; credits: number }> {
    return {
      credits: 8,
      traction: {
        shop_id: signals.shop_id, domain: signals.domain, monthly_sales_usd: 50000, monthly_sales_min_usd: 40000, monthly_sales_max_usd: 60000, units_sold: 1500,
        monthly_visits: signals.monthly_visits, visits_growth_30d: 0.1, active_ads: 3, products_count: 12, product_rank: handle ? 2 : null, ranked_within: 12, single_product: false, fetched_at: "2026-10-19T00:00:00.000Z",
      },
    };
  }
}

describe("traction in a run", () => {
  let pg: PostgresStores;
  beforeAll(async () => {
    pg = await PostgresStores.start();
  });
  afterAll(async () => {
    await pg.stop();
  });

  it("looks up shops for free before the user chooses, skipping marketplace listings, then stores each confirmed shop's traction and its charge", async () => {
    const amazon = "https://www.amazon.com/dp/B0LUNGCLR1";
    const resolution = { ...RESOLUTION, competitors: [...RESOLUTION.competitors, { brand: "Amz", product_name: "Amz drops", url: amazon, why: "x" }] };
    const faux = new Faux();
    const { call } = ScriptedAgents;
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [call("web_fetch", { url: PRODUCT_URL }), call("web_search", { query: "x" }), call("submit", resolution)])
        .on("Product page:", [call("web_fetch", { url: PRODUCT_URL }), call("submit", BRIEF)])
        .on(`Its product page: ${DROPS_URL}`, [call("web_fetch", { url: DROPS_URL }), call("submit", Profiles.of(DROPS_URL, "liquid_drops", true))])
        .on(`Its product page: ${GUMMIES_URL}`, [call("web_fetch", { url: GUMMIES_URL }), call("submit", Profiles.of(GUMMIES_URL, "gummies", true))])
        .steps(),
    );
    const shops = new FakeShops();
    const web = new FakeWeb(PAGES, [...SEARCH_HITS, { title: "amz", url: amazon, snippet: "" }]);
    const pipeline = new Pipeline([new ProductMarketStage(null, new ShopTractionCollector(shops, settings.prices))]);
    const { traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: new ServiceClients(web, web, null, shops), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
    const driver = new RunDriver(app);

    const runId = await driver.start({ product_url: PRODUCT_URL });
    await driver.settle(runId, ["awaiting_confirmation"]);
    expect(shops.looked.sort()).toEqual(["chesttea.com", "lungclear.com", "breathegummies.com", "mullevia.com"].sort());
    const { signals } = await driver.json<{ signals: Record<string, ShopSignals> }>(`/runs/${runId}`);
    expect(signals["lungclear.com"]).toMatchObject({ monthly_visits: 13000 });

    const done = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: resolution.competitors.slice(0, 2).map(({ why: _why, ...pick }) => pick) });
    expect(done.run.stage_status.product_market.status).toBe("completed");
    expect((done.product as Product & { traction: ShopTraction }).traction).toMatchObject({ monthly_sales_usd: 50000, product_rank: 2 });
    expect(done.competitors.map((c: Competitor) => c.traction?.shop_id).sort()).toEqual(["shop-breathegummies.com", "shop-lungclear.com"]);
    const charges = await driver.json<{ charges: { service: string; item: string; units: number }[] }>(`/runs/${runId}/charges`);
    expect(charges.charges.filter((c) => c.item === "shop").map((c) => c.units)).toEqual([8, 8, 8]);
    expect(shops.looked).not.toContain("amazon.com");
    expect(TEA_URL).toBeTruthy();
  });
});
