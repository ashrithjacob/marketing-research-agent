/** Stage 3: one scout per ring pulls running long-form ads with TrendTrack's filters and keeps its quota; an ad two scouts kept stays in the closer ring; one ad of each distinct script is read and the reading copied to the script's other ads; code buckets every ad from its signals. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Message } from "@earendil-works/pi-ai";

import { ServiceClients } from "../src/adapters/index.js";
import { CompetitorAdStage, Pipeline, ProductMarketStage } from "../src/agent/index.js";
import { RingLog } from "../src/agent/stages/ads/ring-log.js";
import { AudienceSegmenter } from "../src/agent/stages/ads/audience-segmenter.js";
import { PageSorter } from "../src/agent/stages/ads/page-sorter.js";
import { RingScout } from "../src/agent/stages/ads/ring-scout.js";
import { PullAdsTool } from "../src/agent/tools/pull-ads-tool.js";
import { AdBuckets, AdRings, type AdCategoryPage, type AdHit, type AdLibrary, type AdPage, type AdQuery, type ReadAd } from "../src/domain/index.js";
import { App } from "../src/http/index.js";

import { Faux, FakeVisuals, FakeWeb, NoBilling, TestSettings } from "./fakes.js";
import { BRIEF, DROPS_URL, GUMMIES_URL, PAGES, PRODUCT_URL, Profiles, RESOLUTION, SEARCH_HITS } from "./mullevia.js";
import { PostgresStores } from "./postgres-stores.js";
import { RunDriver } from "./run-driver.js";
import { ScriptedAgents } from "./scripted-agents.js";

const { call } = ScriptedAgents;
const copy = (line: string) => `${line} `.repeat(60);

const hit = (id: string, domain: string, days: number, status: string, body: string, reach7d = 10): AdHit => ({
  ad_id: id, advertiser: domain, page_id: "1", landing_url: `https://${domain}/p`, landing_domain: domain, first_seen: "2026-08-01", last_seen: "", status,
  countries: ["US"], body, ad_reach: 1000, page_reach_30d: null, page_live_ads: null, days_running: days, duplicates: 2, reach_delta_7d: reach7d, reach_delta_30d: 50,
  current_rank: 4, is_eu: false, media_url: `https://cdn.test/${id}.jpg`, thumbnail_url: null, age_min: 45, age_max: 65, gender: "all",
});

const MARKET = [
  hit("lc1", "lungclear.com", 64, "inactive", copy("I could not stop coughing every morning.")),
  hit("lc2", "lungclear.com", 3, "inactive", copy("I could NOT stop coughing, every morning!")),
  hit("tea1", "chesttea.com", 20, "inactive", copy("My chest tea cleared the mucus.")),
  hit("joint1", "flexjoint.com", 30, "inactive", copy("My joint pain at 60 was gone.")),
  hit("dog1", "dogairway.com", 40, "inactive", copy("My dog honked like a goose.")),
  hit("new1", "lungclear.com", 5, "active", copy("Mullein that reaches the lungs."), 900),
  hit("new2", "lungclear.com", 5, "active", copy("Mullein drops for smokers.")),
];

const by = (ids: string[]) => MARKET.filter((hit) => ids.includes(hit.ad_id));

class FakeAds implements AdLibrary {
  readonly queries: AdQuery[] = [];

  async search(query: AdQuery): Promise<AdPage> {
    this.queries.push(query);
    const hits =
      query.searchIn === "domain" && query.terms[0] === "lungclear.com" ? by(["lc1", "lc2", "new1", "new2"])
      : query.terms[0] === "lung detox" ? by(["tea1", "lc1"])
      : query.terms.length === 0 && query.audience ? by(["joint1", "dog1"])
      : query.terms.length === 0 ? by(["dog1"])
      : [];
    return { hits, total: hits.length, credits: hits.length };
  }

  async categories(): Promise<AdCategoryPage> {
    return { categories: [{ id: 491, name: "Vitamins & Supplements", path: "Health & Beauty > Vitamins & Supplements", ads: 1842 }], credits: 1 };
  }
}

const text = (message: Message | undefined): string => {
  const content = message?.content ?? "";
  return typeof content === "string" ? content : content.map((part) => ("text" in part ? part.text : "")).join("");
};

const reading = (adId: string) => ({
  ad_id: adId, avatar: "Ex-smokers who still wake up coughing", claim_type: "mechanism", awareness: "problem_aware", mechanism: "clears trapped mucus",
  proof_types: ["testimonial"], offer: null, objections_handled: [], emotion: "relief", risk_flags: [], proof_kinds: ["testimonial"], offer_kinds: ["guarantee"], emotion_kind: "relief",
  landing_kind: "advertorial", copy_structure: "personal_story", value_prop: "root_cause",
});

let pg: PostgresStores;

beforeAll(async () => {
  pg = await PostgresStores.start();
});

afterAll(async () => {
  await pg.stop();
});

describe("AdRings.quotas", () => {
  it("splits a pool 40/25/25/10 and gives the rounding to the direct competitors", () => {
    expect(AdRings.quotas(400)).toEqual({ direct_competitor: 160, same_problem: 100, same_buyer: 100, general: 40 });
    expect(AdRings.quotas(10)).toEqual({ direct_competitor: 5, same_problem: 2, same_buyer: 2, general: 1 });
  });
});

describe("RingScout.problems", () => {
  const page = (ids: string[], total: number): AdPage => ({ hits: by(ids), total, credits: ids.length });
  const pulled = (log: RingLog, ids: string[], total: number) => log.record("q", "q", 0, page(ids, total), log.reserve(ids.length));

  it("refuses refs it never showed, a ref kept twice, and more than the quota", () => {
    const log = new RingLog(100);
    pulled(log, ["lc1", "lc2"], 2);
    expect(RingScout.problems({ kept: ["a1", "a1", "a9"], shortfall: null }, log, 2)).toEqual(["a9 was not shown by pull_ads; copy each ref exactly", "a1 is kept twice", "3 ads kept; your quota is 2: keep the strongest 2"]);
  });

  it("takes a shortfall only with a reason, and only once the searches it ran are paged out, the budget is spent or it has searched widely", () => {
    const log = new RingLog(100);
    pulled(log, ["lc1"], 40);
    expect(RingScout.problems({ kept: ["a1"], shortfall: null }, log, 5)).toEqual([
      "1 of 5 ads kept: pull more, or say in shortfall why the market has no more",
      "1 of 5 ads kept after 1 searches, and s1 (39 unseen) still have pages you have not seen: page through them or try other searches",
    ]);
    const done = new RingLog(100);
    pulled(done, ["lc1"], 1);
    expect(RingScout.problems({ kept: ["a1"], shortfall: "only one brand runs these" }, done, 5)).toEqual([]);
    const spent = new RingLog(1);
    pulled(spent, ["lc1"], 40);
    expect(RingScout.problems({ kept: ["a1"], shortfall: "budget spent" }, spent, 5)).toEqual([]);
  });
});

describe("pull_ads's budget", () => {
  const rules = { countries: ["US"], minCopyChars: 3000, minDaysRunning: 10 };
  const run = (tool: ReturnType<PullAdsTool["tool"]>, limit: number) => tool.execute("1", { terms: ["mullein"], limit }).then((r) => (r.content[0] as { text: string }).text);

  it("holds each search's ads when it is sent, so searches sent in one turn cannot together pass the budget", async () => {
    const asked: number[] = [];
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const slow: AdLibrary = {
      search: async (query) => {
        const n = asked.push(query.limit);
        await gate;
        const hits = Array.from({ length: query.limit }, (_, i) => ({ ...MARKET[0]!, ad_id: `x${n}-${i}` }));
        return { hits, total: 500, credits: hits.length };
      },
      categories: async () => ({ categories: [], credits: 0 }),
    };
    const log = new RingLog(100);
    const tool = new PullAdsTool(slow, rules, log).tool();
    const page = (n: number) => tool.execute("1", { terms: ["mullein"], limit: 40, page: n }).then((r) => (r.content[0] as { text: string }).text);
    const replies = [page(1), page(2), page(3), page(4)];
    open();
    const texts = await Promise.all(replies);
    expect(asked).toEqual([40, 40, 20]);
    expect(texts[3]).toMatch(/budget is spent/);
    expect(log.ads).toBe(100);
    expect(log.spent).toBe(true);
  });

  it("refuses a page of a search already sent, in the same turn or later, without fetching or billing it again", async () => {
    let sent = 0;
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const counting: AdLibrary = {
      search: async (query) => {
        sent += 1;
        await gate;
        return { hits: by(["lc1", "lc2"]).slice(0, query.limit), total: 40, credits: 2 };
      },
      categories: async () => ({ categories: [], credits: 0 }),
    };
    const log = new RingLog(100);
    const tool = new PullAdsTool(counting, rules, log).tool();
    const together = [run(tool, 10), run(tool, 10)];
    open();
    const [first, second] = await Promise.all(together);
    expect(first).toMatch(/^Search s1 /);
    expect(second).toMatch(/^Not run: page 1 of this search was already sent in this turn/);
    expect(second).toContain('The settings received were: ad_copy "mullein", longestRunning, 10+ days');
    expect(await run(tool, 25)).toMatch(/^Not run: page 1 of this search was already sent as s1/);
    expect(await tool.execute("1", { terms: ["mullein"], limit: 10, page: 2 }).then((r) => (r.content[0] as { text: string }).text)).toMatch(/^Search s1 /);
    expect(sent).toBe(2);
  });

  it("gives back what a search did not return, and all of it when the search fails", async () => {
    const short: AdLibrary = { search: async () => ({ hits: by(["lc1"]), total: 1, credits: 1 }), categories: async () => ({ categories: [], credits: 0 }) };
    const shortLog = new RingLog(100);
    await run(new PullAdsTool(short, rules, shortLog).tool(), 40);
    expect(shortLog.left).toBe(99);
    const broken: AdLibrary = { search: async () => { throw new Error("TrendTrack returned 500"); }, categories: async () => ({ categories: [], credits: 0 }) };
    const brokenLog = new RingLog(100);
    const brokenTool = new PullAdsTool(broken, rules, brokenLog).tool();
    await expect(run(brokenTool, 40)).rejects.toThrow(/500/);
    expect(brokenLog.left).toBe(100);
    await expect(run(brokenTool, 40)).rejects.toThrow(/500/);
  });
});

describe("PageSorter.problems", () => {
  it("refuses a page left out, one invented, and one sorted twice", () => {
    expect(PageSorter.problems({ pages: [{ page: "p1", kind: "brand" }, { page: "p1", kind: "persona" }, { page: "p9", kind: "authority" }] }, ["p1", "p2"])).toEqual([
      "p2 is not sorted", "p9 was not given; copy each handle exactly", "p1 is sorted twice",
    ]);
  });
});

describe("AudienceSegmenter.pickProblems", () => {
  it("refuses a copy left out, one invented, one sorted twice, and a segment that was never named", () => {
    expect(AudienceSegmenter.pickProblems({ picks: [{ copy: "c1", segment: "copd" }, { copy: "c1", segment: "copd" }, { copy: "c9", segment: "quitters" }] }, ["c1", "c2"], ["copd"])).toEqual([
      "c2 is not sorted", "c9 was not given; copy each handle exactly", "c1 is sorted twice", "c9 is put in quitters, which is not one of the segments; use a key exactly as given",
    ]);
    expect(AudienceSegmenter.nameProblems({ segments: [{ key: "copd", name: "a", description: "b" }, { key: "copd", name: "c", description: "d" }] })).toEqual(["segment key copd is used twice"]);
  });
});

describe("AdBuckets", () => {
  it("calls an ad winning at 10 days, or earlier with traction while running; testing while running without it; dead when it stopped sooner", () => {
    expect(AdBuckets.of({ days_running: 10, status: "inactive", reach_delta_7d: 0, duplicates: 0 })).toEqual({ bucket: "winning", why: "ran 10 days" });
    expect(AdBuckets.of({ days_running: 4, status: "active", reach_delta_7d: 0, duplicates: 5 }).bucket).toBe("winning");
    expect(AdBuckets.of({ days_running: 4, status: "active", reach_delta_7d: 399, duplicates: 4 }).bucket).toBe("testing");
    expect(AdBuckets.of({ days_running: 9, status: "inactive", reach_delta_7d: 900, duplicates: 9 })).toEqual({ bucket: "dead", why: "stopped after 9 days" });
  });
});

describe("stage 3", () => {
  it("pulls each ring with its own scout under the fixed filters, keeps an ad two scouts found in the closer ring, reads each script once, buckets by signal, and stops there", async () => {
    const ads = new FakeAds();
    const readerPrompts: string[] = [];
    const readAll = (messages: Message[]) => {
      const prompt = text(messages.find((m) => m.role === "user"));
      readerPrompts.push(prompt);
      return call("submit", { ads: [...prompt.matchAll(/<ad id="([0-9a-f]+)">/g)].map((m) => reading(m[1]!)) });
    };
    const sortPages = (messages: Message[]) =>
      call("submit", { pages: [...text(messages.find((m) => m.role === "user")).matchAll(/^\[(p\d+)\] "([^"]+)"/gm)].map((m) => ({ page: m[1], kind: m[2] === "dogairway.com" ? "persona" : "brand" })) });
    const nameSegments = (messages: Message[]) =>
      call("submit", { segments: text(messages.find((m) => m.role === "user")).includes("joint")
        ? [{ key: "joint_pain", name: "Joint pain over 60", description: "Older adults whose joints ache" }]
        : [{ key: "ex_smokers", name: "Ex-smokers with a morning cough", description: "Quit, still coughing" }, { key: "copd", name: "COPD patients", description: "On inhalers" }] });
    const sortCopies = (messages: Message[]) => {
      const prompt = text(messages.find((m) => m.role === "user"));
      const key = prompt.includes("joint_pain:") ? "joint_pain" : "ex_smokers";
      return call("submit", { picks: [...prompt.matchAll(/^\[(c\d+)\]/gm)].map((m) => ({ copy: m[1], segment: key })) });
    };
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [call("web_fetch", { url: PRODUCT_URL }), call("web_search", { query: "x" }), call("submit", RESOLUTION)])
        .on("Product page:", [call("web_fetch", { url: PRODUCT_URL }), call("submit", BRIEF)])
        .on(`Its product page: ${DROPS_URL}`, [call("web_fetch", { url: DROPS_URL }), call("submit", Profiles.of(DROPS_URL, "liquid_drops", true))])
        .on(`Its product page: ${GUMMIES_URL}`, [call("web_fetch", { url: GUMMIES_URL }), call("submit", Profiles.of(GUMMIES_URL, "gummies", true))])
        .on("Your ring: direct_competitor", [call("pull_ads", { terms: ["lungclear.com"], search_in: "domain" }), call("submit", { kept: ["a1", "a2", "a3", "a4"], shortfall: "LungClear is the only brand running long-form statics" })])
        .on("Your ring: same_problem", [call("pull_ads", { terms: ["lung detox"], sort_by: "mostDuplicates", min_duplicates: 2 }), call("submit", { kept: ["a1", "a2"], shortfall: null })])
        .on("Your ring: same_buyer", [
          call("find_ad_categories", { search: "supplements" }),
          call("pull_ads", { category_ids: [491], min_age: 45, max_age: 65, limit: 10 }),
          call("submit", { kept: ["a1"], shortfall: "the second ad sells to dog owners" }),
        ])
        .on("Your ring: general", [call("pull_ads", { sort_by: "reach", min_days_running: 30 }), call("submit", { kept: ["a1"], shortfall: null })])
        .on("<ad id=", [readAll])
        .on("Pages to sort:", [sortPages])
        .on("Copies in this market:", [nameSegments])
        .on("Segments:", [sortCopies])
        .steps(),
    );
    const web = new FakeWeb(PAGES, SEARCH_HITS);
    const { settings, traces } = TestSettings.make();
    const pipeline = new Pipeline([new ProductMarketStage(), new CompetitorAdStage(ads, settings.prices, { total: 10, minCopyChars: 3000, minDaysRunning: 10 })]);
    const app = new App({ settings, traces, store: pg.store, services: new ServiceClients(web, web, ads), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
    const driver = new RunDriver(app);
    const picks = RESOLUTION.competitors.slice(0, 2).map(({ why: _why, ...pick }) => pick);

    const runId = await driver.start({ product_url: PRODUCT_URL });
    const done = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: picks });

    expect(done.run.stage_status.competitor_ads).toMatchObject({ status: "completed", error: "" });
    expect(done.run.stage_status.competitor_ads.summary).toMatch(/^7 ads pulled \(direct_competitor 4 of 5, same_problem 1 of 2, same_buyer 1 of 2, general 1 of 1\), 6 distinct scripts; 7 read; pages: 3 brand, 0 community, 1 persona, 0 authority; 3 audience segments\.$/);
    const fixed = { countries: ["US"], activeOnly: true, longForm: { minCopyChars: 3000 } };
    expect(ads.queries).toEqual(expect.arrayContaining([
      { ...fixed, terms: ["lungclear.com"], searchIn: "domain", keywordMode: "any", sortBy: "longestRunning", minDaysRunning: 10, limit: 13, page: 1 },
      { ...fixed, terms: ["lung detox"], searchIn: "ad_copy", keywordMode: "any", sortBy: "mostDuplicates", minDaysRunning: 10, minDuplicates: 2, limit: 5, page: 1 },
      { ...fixed, terms: [], searchIn: "ad_copy", keywordMode: "any", sortBy: "longestRunning", minDaysRunning: 10, categoryIds: [491], audience: { minAge: 45, maxAge: 65 }, limit: 5, page: 1 },
      { ...fixed, terms: [], searchIn: "ad_copy", keywordMode: "any", sortBy: "reach", minDaysRunning: 30, limit: 3, page: 1 },
    ]));
    expect(readerPrompts).toHaveLength(1);
    expect([...readerPrompts[0]!.matchAll(/<ad id=/g)]).toHaveLength(6);
    const { ads: stored } = await driver.json<{ ads: ReadAd[] }>(`/runs/${runId}/ads`);
    const of = Object.fromEntries(stored.map((ad) => [ad.trendtrack_ad_id, ad]));
    expect(Object.keys(of).sort()).toEqual(["dog1", "joint1", "lc1", "lc2", "new1", "new2", "tea1"]);
    const lungclear = done.competitors.find((c) => c.brand === "LungClear")!.id;
    expect(of.lc1).toMatchObject({ competitor_id: lungclear, ring: "direct_competitor", ring_why: 'domain "lungclear.com", longestRunning, 10+ days', bucket: "winning", bucket_why: "ran 64 days" });
    expect(of.lc2).toMatchObject({ ring: "direct_competitor", bucket: "dead" });
    expect(of.lc2!.reading?.claim_type).toBe("mechanism");
    expect([of.tea1!.ring, of.joint1!.ring, of.dog1!.ring]).toEqual(["same_problem", "same_buyer", "general"]);
    expect([of.lc1!.page_kind, of.lc2!.page_kind, of.dog1!.page_kind]).toEqual(["brand", "brand", "persona"]);
    expect([of.lc1!.segment, of.tea1!.segment, of.joint1!.segment, of.dog1!.segment]).toEqual(["Ex-smokers with a morning cough", "Ex-smokers with a morning cough", "Joint pain over 60", null]);
    expect(of.lc2!.reading?.value_prop).toBe("root_cause");
    expect(of.joint1!.ring_why).toBe("no terms, longestRunning, 10+ days, categories 491, audience all 45-65");
    expect((await driver.api(`/runs/${runId}/ads/analysis`)).status).toBe(404);
    const { charges } = await driver.json<{ charges: { service: string; agent_id: string; units: number }[] }>(`/runs/${runId}/charges`);
    expect(charges.filter((c) => c.service === "trendtrack").map((c) => [c.agent_id, c.units]).sort()).toEqual([
      ["ring_scout:direct_competitor", 4], ["ring_scout:general", 1], ["ring_scout:same_buyer", 1], ["ring_scout:same_buyer", 2], ["ring_scout:same_problem", 2],
    ]);

    expect((await driver.api(`/runs/${runId}/rerun`, { stages: ["competitor_ads"] })).status).toBe(200);
    const again = await driver.settle(runId, ["completed", "failed", "invalid"]);
    expect(again.run.stage_status.product_market).toEqual(done.run.stage_status.product_market);
    expect(again.run.stage_status.competitor_ads.summary).toMatch(/^7 ads pulled/);
    expect((await driver.json<{ ads: ReadAd[] }>(`/runs/${runId}/ads`)).ads).toHaveLength(7);
  });
});
