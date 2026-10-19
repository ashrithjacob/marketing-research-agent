/** Stage 4: the market's long-form image ads, found by competitor domain, the key active and the buyer's problem phrases, read in batches by agents that place each ad in a ring and judge its bucket; code refuses a batch that skips an ad, and keywords that lose the key active or fall back on one generic word. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Message } from "@earendil-works/pi-ai";

import { ServiceClients } from "../src/adapters/index.js";
import { CompetitorAdStage, Pipeline, ProductMarketStage } from "../src/agent/index.js";
import { AdSweep } from "../src/agent/stages/ads/ad-sweep.js";
import type { AdHit, AdLibrary, AdPage, AdQuery, ReadAd } from "../src/domain/index.js";
import { App } from "../src/http/index.js";

import { Faux, FakeWeb, NoBilling, FakeVisuals, TestSettings } from "./fakes.js";
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
      ? [FakeAds.hit("lc1", "lungclear.com", 64, LONG), FakeAds.hit("lc2", "lungclear.com", 3, LONG), FakeAds.hit("short", "lungclear.com", 90, "Buy now")]
      : Array.from({ length: 8 }, (_, i) => FakeAds.hit(`${term}-${i}`, `brand${i}.com`, 20 + i, LONG));
    return { hits, total: hits.length, credits: hits.length };
  }

  static hit(id: string, domain: string, days: number, body: string): AdHit {
    return {
      ad_id: id, advertiser: domain, page_id: "1", landing_url: `https://${domain}/p`, landing_domain: domain, first_seen: "2026-08-01", last_seen: "", status: "active",
      countries: ["US"], body, ad_reach: 1000, page_reach_30d: null, page_live_ads: null, days_running: days, duplicates: 2, reach_delta_7d: 10, reach_delta_30d: 50,
      current_rank: 4, is_eu: false, media_url: `https://cdn.test/${id}.jpg`, thumbnail_url: null, age_min: 45, age_max: 65, gender: "all",
    };
  }
}

class Reader {
  refused = "";
  private first = true;

  readonly respond = (messages: Message[]) => {
    const prompt = JSON.stringify(messages.find((m) => m.role === "user")?.content ?? "");
    const ids = [...prompt.matchAll(/<ad id=\\"([0-9a-f]+)\\">\\nadvertiser: ([^;]+);/g)].map((m) => ({ id: m[1]!, advertiser: m[2]! }));
    const last = messages.at(-1);
    if (last?.role === "toolResult") this.refused = JSON.stringify(last.content);
    const kept = this.first ? ids.slice(1) : ids;
    this.first = false;
    return call("submit", { ads: kept.map((ad) => Reader.reading(ad.id, Reader.ring(ad.advertiser))) });
  };

  static ring(advertiser: string): string {
    const n = Number(/brand(\d)/.exec(advertiser)?.[1] ?? 0);
    return n % 2 === 0 ? "same_problem" : n === 5 || n === 7 ? "unrelated" : "same_buyer";
  }

  static reading(adId: string, relation: string) {
    return {
      ad_id: adId, relation, relation_why: "lungs, smokers 45+", avatar: "Ex-smokers who still wake up coughing", claim_type: "mechanism", awareness: "problem_aware", mechanism: "clears trapped mucus", proof_types: ["testimonial"],
      offer: null, objections_handled: [], emotion: "relief", risk_flags: [], bucket: "winning", bucket_why: "64 days running, duplicated",
    };
  }
}

let pg: PostgresStores;

beforeAll(async () => {
  pg = await PostgresStores.start();
});

afterAll(async () => {
  await pg.stop();
});

describe("the sweep", () => {
  it("keeps at most the per-brand cap of one brand's ads in code, because TrendTrack refuses maxAdsPerBrand above 1", async () => {
    const flood: AdLibrary = { search: async () => ({ hits: Array.from({ length: 20 }, (_, i) => FakeAds.hit(`f${i}`, "www.flood.com", 30, LONG)), total: 20 }) };
    const hits = await new AdSweep(flood, { maxAds: 100, minCopyChars: 2000, maxAdsPerBrand: 3 }).sweep({ domains: ["flood.com"], ingredientTerms: ["mullein"], problemPhrases: [], countries: ["US"] });
    expect(hits.map((hit) => hit.ad_id)).toEqual(["f0", "f1", "f2"]);
  });
});

describe("stage 4", () => {
  it("waits for the brief, sweeps by competitor domain and keyword, keeps only long copy, and stores each ad with the bucket its reader judged", async () => {
    const ads = new FakeAds();
    const reader = new Reader();
    let keywordRefusal = "";
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [call("web_fetch", { url: PRODUCT_URL }), call("web_search", { query: "x" }), call("submit", RESOLUTION)])
        .on("Product page:", [call("web_fetch", { url: PRODUCT_URL }), call("submit", BRIEF)])
        .on(`Its product page: ${DROPS_URL}`, [call("web_fetch", { url: DROPS_URL }), call("submit", Profiles.of(DROPS_URL, "liquid_drops", true))])
        .on(`Its product page: ${GUMMIES_URL}`, [call("web_fetch", { url: GUMMIES_URL }), call("submit", Profiles.of(GUMMIES_URL, "gummies", true))])
        .on("Category: lung-support supplement", [
          call("submit", { ingredient_terms: ["herbal drops"], problem_phrases: ["cough", "trapped mucus"] }),
          (messages) => {
            keywordRefusal = JSON.stringify(messages.at(-1)?.content ?? "");
            return call("submit", { ingredient_terms: ["mullein"], problem_phrases: ["morning cough", "trapped mucus"] });
          },
        ])
        .on("<ad id=", [reader.respond, reader.respond])
        .steps(),
    );
    const web = new FakeWeb(PAGES, SEARCH_HITS);
    const limits = { maxAds: 12, minCopyChars: 2000, maxAdsPerBrand: 15 };
    const pipeline = new Pipeline([new ProductMarketStage(), new CompetitorAdStage(ads, TestSettings.make().settings.prices, limits)]);
    const { settings, traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: new ServiceClients(web, web, ads), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
    const driver = new RunDriver(app);
    const picks = RESOLUTION.competitors.slice(0, 2).map(({ why: _why, ...pick }) => pick);

    const runId = await driver.start({ product_url: PRODUCT_URL });
    const done = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: picks });

    expect(done.run.stage_status.competitor_ads).toMatchObject({ status: "completed", error: "" });
    expect(ads.queries.slice(0, 4).map((q) => q.searchIn)).toEqual(["domain", "domain", "domain", "domain"]);
    expect(ads.queries.find((q) => q.terms[0] === "lungclear.com")).toMatchObject({ sortBy: "longestRunning", longForm: { minCopyChars: 2000 } });
    expect(ads.queries.some((q) => q.searchIn === "ad_copy" && q.terms[0] === "mullein")).toBe(true);
    const { ads: stored } = await driver.json<{ ads: ReadAd[] }>(`/runs/${runId}/ads`);
    expect(stored).toHaveLength(12);
    expect(stored.map((ad) => ad.trendtrack_ad_id)).not.toContain("short");
    const lungclear = done.competitors.find((c) => c.brand === "LungClear")!.id;
    expect(stored.find((ad) => ad.trendtrack_ad_id === "lc1")).toMatchObject({ competitor_id: lungclear, days_running: 64, bucket: "winning", bucket_why: "64 days running, duplicated" });
    expect(stored.every((ad) => ad.reading?.claim_type === "mechanism")).toBe(true);
    expect(reader.refused).toContain("was given but not read");
    expect(done.run.stage_status.competitor_ads.summary).toBe("12 long-form statics kept of 30 returned by 5 searches (mullein, morning cough, trapped mucus); 12 read: 2 from competitors, 5 same problem, 3 same buyer, 2 unrelated.");
    expect(keywordRefusal).toContain("no ingredient term names the key active (Mullein leaf extract)");
    expect(keywordRefusal).toContain('\\"cough\\" is one word');
    expect(stored.find((ad) => ad.trendtrack_ad_id === "lc1")?.audience).toEqual({ age_min: 45, age_max: 65, gender: "all" });
  });
});
