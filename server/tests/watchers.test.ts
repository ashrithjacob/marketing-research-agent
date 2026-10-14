/**
 * Part 10 (spec §7.3; docs/plan-meta-integration.md Phase D): Meta ad results read, stored
 * per ad per day and settled after 28 days; a draft linked to its ad and its settled result
 * recorded as outcome feedback; the competitor-ads and reviews watchers. Fakes stand in for
 * Meta and Trendtrack: nothing here calls a paid service.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MetaInsights, type SqlResearchStore } from "../src/adapters/index.js";
import { AdResultsWatch, CompetitorAdsWatch, ReviewsWatch, WorkspaceLimits, WorkspaceSpend } from "../src/agent/index.js";
import { Env } from "../src/config/index.js";
import { AdSums, Scope, ServiceUnavailableError, type AdHit, type AdInsight, type AdInsights, type AdLibrary, type AdPage, type AdQuery } from "../src/domain/index.js";
import { PlaybookScores, PlaybookShelf } from "../src/agent/index.js";
import { SqliteStores } from "./sqlite-stores.js";

const DAY = 86_400_000;
let dir: string;
let store: SqlResearchStore;
let said: string[];
const signal = async (_ws: string, text: string) => void said.push(text);

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-watchers-"));
  store = await SqliteStores.open(join(dir, "research.db"));
  said = [];
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

const day = (now: number, back: number) => new Date(now - back * DAY).toISOString().slice(0, 10);

async function approvedDraft(): Promise<string> {
  const draft = await store.drafts.write("admin", "run-1", { key: "long_form_static", version: 1 }, { key: "hook", text: "x" });
  await store.drafts.mark(draft.id, "approved");
  return draft.id;
}

class FakeInsights implements AdInsights {
  calls = 0;
  constructor(private readonly rows: AdInsight[] | Error) {}
  async read(): Promise<AdInsight[]> {
    this.calls += 1;
    if (this.rows instanceof Error) throw this.rows;
    return this.rows;
  }
}

class FakeAds implements AdLibrary {
  queries: AdQuery[] = [];
  constructor(public hits: AdHit[]) {}
  async search(query: AdQuery): Promise<AdPage> {
    this.queries.push(query);
    return { hits: this.hits, total: this.hits.length, credits: this.hits.length };
  }
}

const hit = (id: string, firstSeen: string): AdHit => ({
  ad_id: id, advertiser: "Rival", page_id: "p", landing_url: "https://rival.example/x", landing_domain: "rival.example", first_seen: firstSeen, last_seen: firstSeen,
  status: "active", countries: [], body: "Sleep like you used to", ad_reach: null, page_reach_30d: null, page_live_ads: null,
});

describe("Meta's Insights API", () => {
  const settings = { ...Env.settings(), metaAccessToken: "tok", metaBaseUrl: "https://graph.test" };

  it("reads every page, one row per ad per day, counting purchases once from the actions", async () => {
    const pages = [
      { data: [{ ad_id: "1", ad_name: "A mra-12345678", date_start: "2026-09-01", spend: "10.5", impressions: "1000", clicks: "20", actions: [{ action_type: "purchase", value: "2" }, { action_type: "omni_purchase", value: "2" }], action_values: [{ action_type: "purchase", value: "60" }] }], paging: { next: "https://graph.test/next" } },
      { data: [{ ad_id: "1", ad_name: "A mra-12345678", date_start: "2026-09-02", spend: "5", impressions: "400", clicks: "4" }] },
    ];
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(pages.shift()), { status: 200 });
    });
    const rows = await new MetaInsights(settings).read("12345", "2026-09-01", "2026-09-02");
    expect(rows).toEqual([
      { ad_id: "1", ad_name: "A mra-12345678", date: "2026-09-01", spend: 10.5, impressions: 1000, clicks: 20, purchases: 2, purchase_value: 60 },
      { ad_id: "1", ad_name: "A mra-12345678", date: "2026-09-02", spend: 5, impressions: 400, clicks: 4, purchases: 0, purchase_value: 0 },
    ]);
    expect(urls[0]).toContain("https://graph.test/v25.0/act_12345/insights?level=ad&time_increment=1");
  });

  it("treats a refused token as the service being unavailable, so the account is marked to reconnect", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { code: 190, message: "Error validating access token" } }), { status: 400 }));
    await expect(new MetaInsights(settings).read("12345", "2026-09-01", "2026-09-02")).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("the ad-results watcher", () => {
  it("links an approved draft to the ad named with its tag, and records its settled week as outcome feedback once", async () => {
    const now = Date.now();
    const draftId = await approvedDraft();
    await store.ads.connect("admin", "12345");
    const name = `Cough ad ${AdSums.tag(draftId)}`;
    const rows: AdInsight[] = [...Array(9).keys()].map((i) => ({ ad_id: "777", ad_name: name, date: day(now, 40 - i), spend: 10, impressions: 1000, clicks: 10, purchases: 1, purchase_value: 30 }));
    rows.push({ ad_id: "777", ad_name: name, date: day(now, 2), spend: 99, impressions: 1, clicks: 0, purchases: 0, purchase_value: 0 });
    const watch = new AdResultsWatch(store, new FakeInsights(rows), signal);
    expect(await watch.check("admin", now)).toBe(now + 6 * 3_600_000);
    expect(await store.ads.links("admin")).toMatchObject([{ draft_id: draftId, ad_id: "777", by: "name" }]);
    const outcome = (await store.feedback.list(Scope.of("admin"), 10)).find((f) => f.verdict === "outcome")!;
    expect(outcome.target).toMatchObject({ kind: "draft", id: draftId });
    expect(outcome.text).toBe("ad 777: $90.00 spent over 9 settled days, 9 purchases, return on ad spend 3.00");
    expect(said).toHaveLength(1);
    await watch.check("admin", now + DAY);
    expect((await store.feedback.list(Scope.of("admin"), 10)).filter((f) => f.verdict === "outcome")).toHaveLength(1);
    const report = await new PlaybookScores(store).report("admin", (await new PlaybookShelf(store).current("admin", "long_form_static"))!);
    expect(report.versions[0]).toMatchObject({ ads: 1, spend: 90, roas: 3 });
  });

  it("marks an account whose token Meta refused to reconnect, and says so once", async () => {
    await store.ads.connect("admin", "12345");
    const watch = new AdResultsWatch(store, new FakeInsights(new ServiceUnavailableError("meta", "Error validating access token")), signal);
    await watch.check("admin", Date.now());
    await watch.check("admin", Date.now() + DAY);
    expect(await store.ads.accounts("admin")).toMatchObject([{ status: "reconnect", error: "Error validating access token" }]);
    expect(said).toEqual(["Ad results: Meta refused the read of ad account 12345 (Error validating access token); it needs reconnecting."]);
  });
});

describe("the competitor-ads watcher", () => {
  it("sets a baseline first, then signals ads first seen since; each search is charged to the workspace's day", async () => {
    const now = Date.now();
    const ads = new FakeAds([hit("a1", day(now, 10))]);
    const limits = new WorkspaceLimits(store, new WorkspaceSpend(store));
    await store.alwaysOn.set("admin", true, 5);
    await store.watch.addBrand("admin", "Rival", "brand");
    const watch = new CompetitorAdsWatch(store, ads, { trendtrackUsdPerCredit: 0.01 }, limits, signal);
    await watch.check("admin", now);
    expect(said).toEqual([]);
    ads.hits = [hit("a1", day(now, 10)), hit("a2", day(now, -1))];
    await watch.check("admin", now + DAY);
    expect(said).toEqual([`Competitor ads: Rival: 1 new ad since ${day(now, 0)}, e.g. "Sleep like you used to" to rival.example.`]);
    expect(ads.queries[0]).toMatchObject({ terms: ["Rival"], searchIn: "brand", sortBy: "newest" });
    expect(await new WorkspaceSpend(store).today("admin")).toBeCloseTo(0.03);
  });

  it("does not search once today's spend has reached the daily cap", async () => {
    const ads = new FakeAds([]);
    await store.alwaysOn.set("admin", true, 0.01);
    await store.watch.addBrand("admin", "Rival", "brand");
    await store.watch.charge("admin", "test", { service: "trendtrack", item: "ads", units: 2, usd: 0.02, basis: "credits" });
    await new CompetitorAdsWatch(store, ads, { trendtrackUsdPerCredit: 0.01 }, new WorkspaceLimits(store, new WorkspaceSpend(store)), signal).check("admin", Date.now());
    expect(ads.queries).toEqual([]);
  });
});

describe("the reviews watcher", () => {
  it("signals a listing whose stored reviews are past the reuse window, once per pull, and never pulls", async () => {
    const run = await store.createRun({ workspaceId: "admin", brief: { product: "MagnaCalm", url: "", market: "", notes: "" }, model: "m", rejectKinds: [], judgementIds: [], nodes: ["competitors"], stage: 1 });
    await store.listings.save({ source_run_id: run.id, target_id: "c1", query: "q", strategy: "s", listing: { asin: "B0TEST", title: "Rival Gummies" } as never, matches: true, mismatch: "", error: "", fetched_at: "t" });
    await store.pulls.save("amazon", "B0TEST", 3, 50, { status: "SUCCEEDED", excerpts: [], gap: null, offBand: 0, totalReviews: null, totalRatings: null });
    const watch = new ReviewsWatch(store, 183, signal);
    await watch.check("admin", Date.now() + 10 * DAY);
    expect(said).toEqual([]);
    await watch.check("admin", Date.now() + 200 * DAY);
    await watch.check("admin", Date.now() + 201 * DAY);
    expect(said).toHaveLength(1);
    expect(said[0]).toContain("Rival Gummies (B0TEST), pulled 200 days ago");
    expect(said[0]).toContain("needs the owner's approval");
  });
});
