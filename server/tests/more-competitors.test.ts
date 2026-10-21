/** Competitors added to a finished run: a search proposes ones it does not have, and the ones the user picks are profiled and their reviews collected, without the brief or the existing competitors being redone. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AmazonListingFinder, Pipeline, ProductMarketStage, ReviewListings, ReviewStage } from "../src/agent/index.js";
import { Stages, type AdHit, type CollectedReview, type ReviewListing, type ReviewSource, type ReviewSourceName, type Storefront, type StorefrontFacts } from "../src/domain/index.js";
import { App } from "../src/http/index.js";

import { Faux, FakeWeb, NoBilling, FakeVisuals, TestSettings } from "./fakes.js";
import { BRIEF, DROPS_URL, GUMMIES_URL, PAGES, PRODUCT_URL, Profiles, RESOLUTION, SEARCH_HITS } from "./mullevia.js";
import { PostgresStores } from "./postgres-stores.js";
import { RunDriver } from "./run-driver.js";
import { ScriptedAgents } from "./scripted-agents.js";

const { call } = ScriptedAgents;
const HERBEYA_URL = "https://herbeya.com/products/mullein-leaf-extract-drops";
const GUMMIES_AMAZON = "https://www.amazon.com/Breathe-Gummies/dp/B0BREATHE1";

class FakeStorefront implements Storefront {
  async inspect(url: string): Promise<StorefrontFacts | null> {
    return url === PRODUCT_URL ? { shop_domain: "mullevia.myshopify.com", product_id: "157", review_apps: ["judgeme"] } : null;
  }
}

class FakeSource implements ReviewSource {
  readonly asked: ReviewListing[] = [];

  constructor(readonly name: ReviewSourceName) {}

  async collect(listing: ReviewListing, limit: number): Promise<CollectedReview[]> {
    this.asked.push(listing);
    const key = listing.source === "amazon" ? listing.asin : listing.product_id;
    return Array.from({ length: Math.min(3, limit) }, (_, i) => ({ source: this.name, source_review_id: `${key}-${i}`, rating: 3, title: "", body: `review ${i}`, review_date: "2026-09-01", verified: true, helpful_votes: 0, country: null }));
  }
}

let pg: PostgresStores;
beforeAll(async () => {
  pg = await PostgresStores.start();
});
afterAll(async () => {
  await pg.stop();
});

describe("more competitors for a finished run", () => {
  it("proposes only ones the run lacks, then researches the picked one alone and ends completed", async () => {
    let briefs = 0;
    const judgeme = new FakeSource("judgeme");
    const amazon = new FakeSource("amazon");
    const herbeya = { brand: "Herbeya", product_name: "Mullein Leaf Extract Drops", url: HERBEYA_URL, why: "same drops" };
    const script = new ScriptedAgents()
      .on("Product url:", [call("web_fetch", { url: PRODUCT_URL }), call("web_search", { query: "mullein drops" }), call("submit", RESOLUTION)])
      .on("Product page:", [() => (briefs++, call("web_fetch", { url: PRODUCT_URL })), call("submit", BRIEF)])
      .on(`Its product page: ${DROPS_URL}`, [call("web_fetch", { url: DROPS_URL }), call("submit", Profiles.of(DROPS_URL, "liquid_drops", true))])
      .on(`Its product page: ${GUMMIES_URL}`, [call("web_fetch", { url: GUMMIES_URL }), call("submit", Profiles.of(GUMMIES_URL, "gummies", true))])
      .on("Product: Mullein Drops", [call("submit", { amazon_url: null, why: "own store only" })])
      .on("Product: LungClear", [call("submit", { amazon_url: null, why: "not on Amazon" })])
      .on("Product: Breathe", [call("web_search", { query: "breathe gummies amazon" }), call("submit", { amazon_url: GUMMIES_AMAZON, why: "same gummies" })])
      .on("Find more competitors for:", [call("web_search", { query: "mullein drops brands" }), call("submit", { competitors: [{ ...RESOLUTION.competitors[0]!, why: "x" }] }), call("submit", { competitors: [herbeya] })]);
    const faux = new Faux();
    faux.provider.setResponses(script.steps());
    const web = new FakeWeb(PAGES, [...SEARCH_HITS, { title: "Herbeya", url: HERBEYA_URL, snippet: "" }, { title: "Breathe on Amazon", url: GUMMIES_AMAZON, snippet: "" }]);
    const reviews = new ReviewStage(new ReviewListings(new FakeStorefront(), new AmazonListingFinder()), new Map<ReviewSourceName, ReviewSource>([["judgeme", judgeme], ["amazon", amazon]]), 50);
    const { settings, traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: web.services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline: new Pipeline([new ProductMarketStage(), reviews]) });
    const driver = new RunDriver(app);
    const [lungclear, breathe] = RESOLUTION.competitors.map(({ why: _why, ...pick }) => pick);

    const runId = await driver.start({ product_url: PRODUCT_URL });
    const first = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: [lungclear] });
    expect(first.run.status).toBe("completed");
    const stagesBefore = first.run.stage_status;

    expect((await driver.api(`/runs/${runId}/competitors/search`, {})).status).toBe(200);
    const searched = await driver.settle(runId, ["completed", "invalid", "failed"]);
    expect(searched.run.status).toBe("completed");
    expect(searched.run.resolution?.competitors.map((c) => c.brand)).toEqual(["LungClear", "Breathe", "Chest Tea", "Herbeya"]);

    const again = await driver.api(`/runs/${runId}/competitors`, { competitors: [lungclear] });
    expect(again.status).toBe(409);
    expect(JSON.stringify(await again.json())).toContain("already researched in this run");

    judgeme.asked.length = 0;
    expect((await driver.api(`/runs/${runId}/competitors`, { competitors: [breathe] })).status).toBe(200);
    const done = await driver.settle(runId, ["completed", "invalid", "failed"]);

    expect(script.unmatched).toEqual([]);
    expect(done.run.status).toBe("completed");
    expect(briefs).toBe(1);
    expect(done.run.stage_status).toEqual(stagesBefore);
    expect(Object.fromEntries(done.competitors.map((c) => [c.brand, c.relationship]))).toEqual({ LungClear: "direct", Breathe: "indirect" });
    expect(judgeme.asked).toEqual([]);
    expect(amazon.asked).toEqual([{ source: "amazon", asin: "B0BREATHE1" }]);
    const { coverage } = await driver.json<{ coverage: { competitor_id: string | null; reviews: number }[] }>(`/runs/${runId}/reviews`);
    expect(coverage.find((row) => row.competitor_id === done.competitors.find((c) => c.brand === "Breathe")!.id)?.reviews).toBe(3);
  });

  it("gives an added competitor the ads this run already kept that land on its site, and leaves every other ad alone", async () => {
    const product = await pg.store.products.upsert("admin", PRODUCT_URL, "Mullein Drops", "Mullevia");
    const run = await pg.store.runs.create({ accountId: "admin", input: { product_url: PRODUCT_URL, product_name: null, markets: ["US"] }, model: "m", stages: Stages.initial([]) });
    const hit = (id: string, domain: string): AdHit => ({
      ad_id: id, advertiser: domain, page_id: "1", landing_url: `https://${domain}/p`, landing_domain: domain, first_seen: "2026-08-01", last_seen: "", status: "active", countries: ["US"], body: "copy",
      ad_reach: 10, page_reach_30d: null, page_live_ads: null, days_running: 40, duplicates: 1, reach_delta_7d: null, reach_delta_30d: null, current_rank: null, is_eu: false,
      media_url: null, thumbnail_url: null, age_min: null, age_max: null, gender: null,
    });
    await pg.store.ads.save("admin", run.id, product.id, [hit("h1", "www.herbeya.com"), hit("o1", "other.com")], new Map());
    const [herbeya] = await pg.store.competitors.add(product, [{ brand: "Herbeya", product_name: "Drops", url: HERBEYA_URL }]);

    expect(await pg.store.ads.link(run.id, new Map([["herbeya.com", herbeya!.id]]))).toBe(1);
    const owners = Object.fromEntries((await pg.store.ads.list(run.id)).map((ad) => [ad.trendtrack_ad_id, ad.competitor_id]));
    expect(owners).toEqual({ h1: herbeya!.id, o1: null });
  });
});
