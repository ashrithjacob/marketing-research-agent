/** Stage 3: a scout agent studies the market's long-form ads with search_ads, read_ad and find_trending_shops, discovering brands as it goes, and keeps ads in a growth marketer's rings; code refuses an ad it never saw and holds the budget; each kept ad is then read. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Message } from "@earendil-works/pi-ai";

import { ServiceClients } from "../src/adapters/index.js";
import { CompetitorAdStage, Pipeline, ProductMarketStage } from "../src/agent/index.js";
import { ScoutLog } from "../src/agent/stages/ads/scout-log.js";
import { SearchLongFormTool } from "../src/agent/tools/search-long-form-tool.js";
import { TrendingShopsTool } from "../src/agent/tools/trending-shops-tool.js";
import type { AdHit, AdLibrary, AdPage, AdQuery, ReadAd, ShopFinder, ShopPage, ShopQuery } from "../src/domain/index.js";
import { App } from "../src/http/index.js";

import { Faux, FakeVisuals, FakeWeb, NoBilling, TestSettings } from "./fakes.js";
import { BRIEF, DROPS_URL, GUMMIES_URL, PAGES, PRODUCT_URL, Profiles, RESOLUTION, SEARCH_HITS } from "./mullevia.js";
import { PostgresStores } from "./postgres-stores.js";
import { RunDriver } from "./run-driver.js";
import { ScriptedAgents } from "./scripted-agents.js";

const { call } = ScriptedAgents;
const LONG = "I could not stop coughing every morning. ".repeat(60);

class FakeAds implements AdLibrary {
  readonly queries: AdQuery[] = [];

  async search(query: AdQuery): Promise<AdPage> {
    this.queries.push(query);
    const term = query.terms[0]!;
    const hits = term === "lungclear.com"
      ? [FakeAds.hit("lc1", "lungclear.com", 64), FakeAds.hit("lc2", "lungclear.com", 3)]
      : term === "glowpatch.com"
        ? [FakeAds.hit("gp1", "glowpatch.com", 90)]
        : Array.from({ length: Math.min(query.limit, 8) }, (_, i) => FakeAds.hit(`${term}-${i}`, `brand${i}.com`, 20 + i));
    return { hits, total: hits.length, credits: hits.length };
  }

  static hit(id: string, domain: string, days: number): AdHit {
    return {
      ad_id: id, advertiser: domain, page_id: "1", landing_url: `https://${domain}/p`, landing_domain: domain, first_seen: "2026-08-01", last_seen: "", status: "active",
      countries: ["US"], body: LONG, ad_reach: 1000, page_reach_30d: null, page_live_ads: null, days_running: days, duplicates: 2, reach_delta_7d: 10, reach_delta_30d: 50,
      current_rank: 4, is_eu: false, media_url: `https://cdn.test/${id}.jpg`, thumbnail_url: null, age_min: 45, age_max: 65, gender: "all",
    };
  }
}

class FakeShops implements ShopFinder {
  readonly queries: ShopQuery[] = [];

  async find(query: ShopQuery): Promise<ShopPage> {
    this.queries.push(query);
    const shops = [
      { domain: "glowpatch.com", name: "GlowPatch", main_category: "Health & Beauty", monthly_visits: 412000, visits_growth_30d: 0.62, monthly_sales_usd: 318400, active_ads: 140, best_sellers: ["Sleep Patch", "Energy Patch"] },
      { domain: "dressly.com", name: "Dressly", main_category: "Apparel", monthly_visits: null, visits_growth_30d: null, monthly_sales_usd: null, active_ads: 33, best_sellers: [] },
    ].slice(0, query.limit);
    return { shops, total: 1489, credits: 4 * shops.length };
  }
}

const text = (message: Message | undefined): string => {
  const content = message?.content ?? "";
  return typeof content === "string" ? content : content.map((part) => ("text" in part ? part.text : "")).join("");
};

const reading = (adId: string) => ({
  ad_id: adId, avatar: "Ex-smokers who still wake up coughing", claim_type: "mechanism", awareness: "problem_aware", mechanism: "clears trapped mucus", proof_types: ["testimonial"],
  offer: null, objections_handled: [], emotion: "relief", risk_flags: [], bucket: "winning", bucket_why: "64 days running, duplicated",
});

const readAll = (messages: Message[]) => call("submit", { ads: [...text(messages.find((m) => m.role === "user")).matchAll(/<ad id="([0-9a-f]+)">/g)].map((m) => reading(m[1]!)) });

describe("search_ads", () => {
  it("logs every ad it shows and refuses to search once the budget is spent", async () => {
    const log = new ScoutLog(1);
    const tool = new SearchLongFormTool(new FakeAds(), ["US"], 2000, log).tool();
    const first = await tool.execute("1", { query: "mullein", search_in: "ad_copy", sort_by: "longestRunning", limit: 3 });
    expect((first.content[0] as { text: string }).text).toContain("[mullein-0] brand0.com → brand0.com | active, 20 days, 2 duplicates, reach 1000, +10 reach in 7 days | all 45-65");
    expect(log.ad("mullein-2")?.landing_domain).toBe("brand2.com");
    const refused = await tool.execute("x", { query: "nac", search_in: "ad_copy", sort_by: "reachDelta30d" });
    expect((refused.content[0] as { text: string }).text).toContain("sort_by reachDelta30d is not one TrendTrack accepts");
    const second = await tool.execute("2", { query: "nac", search_in: "ad_copy", sort_by: "reachDelta7d" });
    expect((second.content[0] as { text: string }).text).toContain("Your search budget (1) is spent");
    expect(log.searched).toBe(1);
  });
});

describe("find_trending_shops", () => {
  it("lists trending shops in the run's markets, spends one search of the scout's budget, and refuses once it is spent", async () => {
    const log = new ScoutLog(1);
    const shops = new FakeShops();
    const tool = new TrendingShopsTool(shops, ["US"], log).tool();
    const refused = await tool.execute("x", { sort_by: "unitsSold" });
    expect((refused.content[0] as { text: string }).text).toContain("sort_by unitsSold is not one this tool accepts");
    const first = await tool.execute("1", { query: "supplements", sort_by: "estMonthlySales", limit: 2 });
    const shown = (first.content[0] as { text: string }).text;
    expect(shown).toContain("glowpatch.com (GlowPatch) | Health & Beauty | $318,400/mo sales | 412000 visits/mo, +62% in 30 days | 140 active ads\n   best sellers: Sleep Patch; Energy Patch");
    expect(shown).toContain("dressly.com (Dressly) | Apparel | sales unknown | ? visits/mo | 33 active ads");
    expect(shops.queries[0]).toEqual({ text: "supplements", searchIn: "product_text", countries: ["US"], sortBy: "estMonthlySales", minActiveAds: 20, limit: 2 });
    expect(log.shopsSeen).toBe(2);
    const second = await tool.execute("2", { sort_by: "activeAds" });
    expect((second.content[0] as { text: string }).text).toContain("Your search budget (1) is spent");
    expect(shops.queries).toHaveLength(1);
  });
});

let pg: PostgresStores;

beforeAll(async () => {
  pg = await PostgresStores.start();
});

afterAll(async () => {
  await pg.stop();
});

describe("stage 3", () => {
  it("lets the scout search, read and keep ads in rings, refuses an ad it never saw, then reads every kept ad", async () => {
    const ads = new FakeAds();
    let refusal = "";
    let scouts = 0;
    const keep = [
      { ad_id: "lc1", ring: "direct_competitor", why: "LungClear's own tincture, 64 days" },
      { ad_id: "mullein-0", ring: "same_problem", why: "lung tea for smokers, 45+" },
      { ad_id: "mullein-1", ring: "same_buyer", why: "joint pain advertorial for 50+, winning" },
      { ad_id: "gp1", ring: "trending_shop", why: "sleep patch advertorial, 90 days, shop scaling on long-form" },
    ];
    const brands = [{ brand: "LungClear", domain: "lungclear.com", ring: "direct_competitor", why: "mullein tincture" }];
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [call("web_fetch", { url: PRODUCT_URL }), call("web_search", { query: "x" }), call("submit", RESOLUTION)])
        .on("Product page:", [call("web_fetch", { url: PRODUCT_URL }), call("submit", BRIEF)])
        .on(`Its product page: ${DROPS_URL}`, [call("web_fetch", { url: DROPS_URL }), call("submit", Profiles.of(DROPS_URL, "liquid_drops", true))])
        .on(`Its product page: ${GUMMIES_URL}`, [call("web_fetch", { url: GUMMIES_URL }), call("submit", Profiles.of(GUMMIES_URL, "gummies", true))])
        .on("Confirmed competitors:", [
          call("search_ads", { query: "lungclear.com", search_in: "domain", sort_by: "longestRunning", limit: 5 }),
          call("search_ads", { query: "mullein", search_in: "ad_copy", sort_by: "reachDelta7d", limit: 4 }),
          call("read_ad", { ad_id: "mullein-1" }),
          call("find_trending_shops", { sort_by: "estMonthlySales", limit: 1 }),
          call("search_ads", { query: "glowpatch.com", search_in: "domain", sort_by: "longestRunning", limit: 3 }),
          call("submit", { kept: [...keep, { ad_id: "ghost-9", ring: "same_problem", why: "x" }], brands }),
          (messages) => {
            refusal = JSON.stringify(messages.at(-1)?.content ?? "");
            scouts += 1;
            return call("submit", { kept: scouts === 1 ? keep : keep.slice(0, 1), brands });
          },
        ])
        .on("<ad id=", [readAll])
        .steps(),
    );
    const web = new FakeWeb(PAGES, SEARCH_HITS);
    const limits = { searches: 20, maxAds: 150, maxAdsPerBrand: 15, minCopyChars: 2000 };
    const shops = new FakeShops();
    const pipeline = new Pipeline([new ProductMarketStage(), new CompetitorAdStage(ads, shops, TestSettings.make().settings.prices, limits)]);
    const { settings, traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: new ServiceClients(web, web, ads), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
    const driver = new RunDriver(app);
    const picks = RESOLUTION.competitors.slice(0, 2).map(({ why: _why, ...pick }) => pick);

    const runId = await driver.start({ product_url: PRODUCT_URL });
    const done = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: picks });

    expect(done.run.stage_status.competitor_ads).toMatchObject({ status: "completed", error: "" });
    expect(done.run.stage_status.competitor_ads.summary).toBe("4 ads kept of 7 seen in 4 searches (1 trending shops looked at), from 1 brands; 1 direct competitor, 1 same problem, 1 same buyer, 1 trending shop; 4 read.");
    expect(refusal).toContain("ad ghost-9 was not in any of your searches");
    expect(ads.queries.map((q) => [q.terms[0], q.searchIn, q.sortBy, q.longForm?.minCopyChars])).toEqual([["lungclear.com", "domain", "longestRunning", 2000], ["mullein", "ad_copy", "reachDelta7d", 2000], ["glowpatch.com", "domain", "longestRunning", 2000]]);
    expect(shops.queries.map((q) => [q.text, q.sortBy, q.countries])).toEqual([[null, "estMonthlySales", ["US"]]]);
    const { ads: stored } = await driver.json<{ ads: ReadAd[] }>(`/runs/${runId}/ads`);
    const lungclear = done.competitors.find((c) => c.brand === "LungClear")!.id;
    expect(stored.map((ad) => [ad.trendtrack_ad_id, ad.ring]).sort()).toEqual([["gp1", "trending_shop"], ["lc1", "direct_competitor"], ["mullein-0", "same_problem"], ["mullein-1", "same_buyer"]]);
    expect(stored.find((ad) => ad.trendtrack_ad_id === "lc1")).toMatchObject({ competitor_id: lungclear, bucket: "winning", ring_why: "LungClear's own tincture, 64 days" });
    expect(stored.every((ad) => ad.reading?.claim_type === "mechanism")).toBe(true);
    const { charges } = await driver.json<{ charges: { service: string; agent_id: string; units: number }[] }>(`/runs/${runId}/charges`);
    expect(charges.filter((c) => c.service === "trendtrack").map((c) => [c.agent_id, c.units])).toEqual([["ad_scout", 2], ["ad_scout", 4], ["ad_scout", 4], ["ad_scout", 1]]);

    expect((await driver.api(`/runs/${runId}/rerun`, { stages: ["competitor_ads"] })).status).toBe(200);
    const again = await driver.settle(runId, ["completed", "failed", "invalid"]);
    expect(again.run.stage_status.product_market).toEqual(done.run.stage_status.product_market);
    expect(again.run.stage_status.competitor_ads.summary).toMatch(/^1 ads kept of 7 seen/);
    const { ads: replaced } = await driver.json<{ ads: ReadAd[] }>(`/runs/${runId}/ads`);
    expect(replaced.map((ad) => ad.trendtrack_ad_id)).toEqual(["lc1"]);
  });
});
