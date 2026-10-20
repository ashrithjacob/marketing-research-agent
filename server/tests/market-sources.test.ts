/** Stage 4's outside sources, with the request and response shapes read from each service on 2026-10-20: Apify's run, run and dataset endpoints and three actors' fields, Google's and Amazon's search-box completions, the Wayback Machine's index, and TrendTrack's first-seen window. */
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApifyAmazonSearch, ApifyKeywordVolumes, ApifyRedditSearch, ApifyRunner, PublicPage, WaybackArchive, WebSuggestions } from "../src/adapters/index.js";
import { TrendtrackAds } from "../src/adapters/trendtrack-ads.js";
import type { ActorLimits, ActorRun, ActorRunner } from "../src/domain/index.js";

import { TestSettings } from "./fakes.js";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const { settings } = TestSettings.make({ apifyToken: "apify-test", trendtrackApiKey: "tt-test", trendtrackBaseUrl: "https://trendtrack.test" });

class CannedRunner implements ActorRunner {
  readonly calls: Array<{ actor: string; input: Record<string, unknown>; limits: ActorLimits }> = [];
  constructor(private readonly answer: ActorRun) {}
  async run(actor: string, input: Record<string, unknown>, limits: ActorLimits): Promise<ActorRun> {
    this.calls.push({ actor, input, limits });
    return this.answer;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("the Apify runner", () => {
  it("starts the actor with its limits, waits for it, reads its dataset, and returns what Apify billed", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("/acts/memo23~keyword-metrics/runs")) return json({ data: { id: "r1", status: "RUNNING", defaultDatasetId: "d1" } });
      if (url.includes("/actor-runs/r1")) return json({ data: { id: "r1", status: "SUCCEEDED", defaultDatasetId: "d1", usageTotalUsd: 0.3 } });
      return json([{ keyword: "mullein for lungs", google_search_volume: 6600 }]);
    });
    vi.stubGlobal("fetch", fetch);
    const run = await new ApifyRunner(settings).run("memo23/keyword-metrics", { keywords: ["mullein for lungs"] }, { maxTotalChargeUsd: 1, timeoutSeconds: 600, memoryMb: 512 });
    expect(run).toEqual({ status: "SUCCEEDED", items: [{ keyword: "mullein for lungs", google_search_volume: 6600 }], usd: 0.3 });
    const start = new URL(String(fetch.mock.calls[0]![0]));
    expect(Object.fromEntries(start.searchParams)).toMatchObject({ maxTotalChargeUsd: "1", timeout: "600", memory: "512" });
  });

  it("aborts a run still going when its wait is over, so it stops spending, and still reports its cost", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      if (url.endsWith("/abort")) return json({ data: { id: "r2", status: "ABORTING", defaultDatasetId: "d2" } });
      if (url.includes("/actor-runs/r2")) return json({ data: { id: "r2", status: urls.some((u) => u.endsWith("/abort")) ? "ABORTED" : "RUNNING", defaultDatasetId: "d2", usageTotalUsd: 0.02 } });
      if (url.includes("/datasets/")) return json([]);
      return json({ data: { id: "r2", status: "RUNNING", defaultDatasetId: "d2" } });
    }));
    const run = await new ApifyRunner({ ...settings, apifyWaitSeconds: 0 }).run("coding-doctor-omar/reddit-scraper-pro", {}, { maxTotalChargeUsd: null, timeoutSeconds: 300, memoryMb: 1024 });
    expect(run).toMatchObject({ status: "ABORTED", usd: 0.02, items: [] });
    expect(urls.some((url) => url.endsWith("/actor-runs/r2/abort"))).toBe(true);
    expect(urls[0]).not.toContain("maxTotalChargeUsd");
  });
});

describe("the three actors", () => {
  it("asks memo23 for Google volumes only, Bing being a second billed batch", async () => {
    const runner = new CannedRunner({ status: "SUCCEEDED", usd: 0.3, items: [{ keyword: "mullein for lungs", google_search_volume: 6600, search_intent: "commercial", trend: "rising" }] });
    expect(await new ApifyKeywordVolumes(runner).volumes(["mullein for lungs"], "us")).toEqual([{ keyword: "mullein for lungs", monthly_searches: 6600, intent: "commercial", trend: "rising" }]);
    expect(runner.calls[0]!.input).toEqual({ mode: "metrics", keywords: ["mullein for lungs"], country: "us", includeGoogle: true, includeBing: false });
  });

  it("reads Amazon listings with sponsored flagged, and Reddit with its comment defaults capped", async () => {
    const amazon = new CannedRunner({ status: "SUCCEEDED", usd: 0.02, items: [{ asin: "B0X", title: "Mullein Drops 7-in-1 Lung Detox", url: "https://amazon.com/dp/B0X", keyword: "mullein drops", rating: 4.4, ratingsCount: 2310, price: "$19.99", isSponsored: true, organicPosition: null }] });
    expect((await new ApifyAmazonSearch(amazon).search(["mullein drops"], "us", 30))[0]).toMatchObject({ asin: "B0X", ratings_count: 2310, price: 19.99, sponsored: true, organic_position: null });
    const reddit = new CannedRunner({ status: "SUCCEEDED", usd: 0.01, items: [{ submissionId: "p1", submissionType: "comment", submissionUrl: "https://reddit.com/r/COPD/p1", subreddit: "r/COPD", title: null, bodyText: "Mullein did nothing for me", score: 4, submittedAt: "2026-08-01T00:00:00Z" }] });
    expect(await new ApifyRedditSearch(reddit).search({ keywords: ["mullein"], subreddits: [], maxPosts: 25, commentsPerPost: 15 })).toEqual([{ id: "p1", kind: "comment", url: "https://reddit.com/r/COPD/p1", subreddit: "r/COPD", title: null, body: "Mullein did nothing for me", score: 4, posted_at: "2026-08-01" }]);
    expect(reddit.calls[0]!.input).toMatchObject({ scrapingMode: "keywordSearch", maxCommentsPerPost: 15, maxCommentsDepth: 2 });
    expect(reddit.calls[0]!.limits.maxTotalChargeUsd).toBeNull();
  });

  it("treats an empty dataset on a run that succeeded as a failure to read, not as no results", async () => {
    await expect(new ApifyKeywordVolumes(new CannedRunner({ status: "SUCCEEDED", usd: 0.05, items: [] })).volumes(["x"], "us")).rejects.toThrow("failure to read");
    await expect(new ApifyAmazonSearch(new CannedRunner({ status: "TIMED-OUT", usd: 0.05, items: [] })).search(["x"], "us", 10)).rejects.toThrow("ended TIMED-OUT");
  });
});

describe("the free sources", () => {
  it("reads Google's and Amazon's completions, and refuses an Amazon market never seen working", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("suggestqueries") ? json(["mullein for", ["mullein for copd", "mullein for mucus"]]) : json({ suggestions: [{ value: "mullein drops for lungs" }] }))));
    const box = new WebSuggestions(settings);
    expect(await box.suggest("mullein for", "google", "us")).toEqual(["mullein for copd", "mullein for mucus"]);
    expect(await box.suggest("mullein", "amazon", "gb")).toEqual(["mullein drops for lungs"]);
    await expect(box.suggest("mullein", "amazon", "au")).rejects.toThrow("only the US and the UK");
  });

  it("lists a page's monthly snapshots and reads one as text", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("/cdx/") ? json([["timestamp", "original"], ["20190901000000", "trybetterbrand.com/"], ["20240501000000", "trybetterbrand.com/"]]) : new Response("<html><script>x()</script><h1>Clear your lungs</h1><p>in 7 days</p></html>"))));
    const archive = new WaybackArchive(settings, new PublicPage(settings));
    const snapshots = await archive.snapshots("trybetterbrand.com");
    expect(snapshots).toEqual([{ timestamp: "20190901000000", url: "trybetterbrand.com/" }, { timestamp: "20240501000000", url: "trybetterbrand.com/" }]);
    expect(WaybackArchive.text("<script>x()</script><h1>Clear your lungs</h1><p>in 7 days</p>")).toBe("Clear your lungs\nin 7 days");
  });

  it("sends TrendTrack a first-seen window for an ad history search", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => json({ data: [], pagination: { total: 0 } }));
    vi.stubGlobal("fetch", fetch);
    await new TrendtrackAds(settings).search({ terms: ["lungclear.com"], searchIn: "domain", countries: ["US"], limit: 5, sortBy: "newest", createdAfter: "2024-01-01", createdBefore: "2025-01-01" });
    expect(JSON.parse(String(fetch.mock.calls[0]![1].body))).toMatchObject({ status: "all", createdAfter: "2024-01-01", createdBefore: "2025-01-01" });
  });
});
