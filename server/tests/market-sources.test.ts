/** Stage 4's outside sources, with the request and response shapes read from each service on 2026-10-20: Apify's run, run and dataset endpoints and three actors' fields, Google's and Amazon's search-box completions, the Wayback Machine's index, and TrendTrack's first-seen window. */
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApifyAmazonSearch, ApifyApi, ApifyKeywordVolumes, ApifyRedditSearch, ApifyRunner, PublicPage, WaybackArchive, WebSuggestions } from "../src/adapters/index.js";
import { TrendtrackAds } from "../src/adapters/trendtrack-ads.js";
import type { ActorLimits, ActorRun, ActorRunner } from "../src/domain/index.js";

import { TestSettings } from "./fakes.js";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const { settings } = TestSettings.make({ apifyToken: "apify-test", trendtrackApiKey: "tt-test", trendtrackBaseUrl: "https://trendtrack.test" });

class CannedRunner implements ActorRunner {
  readonly calls: Array<{ actor: string; input: Record<string, unknown>; limits: ActorLimits }> = [];
  constructor(private readonly answer: Pick<ActorRun, "status" | "items">) {}
  async run(actor: string, input: Record<string, unknown>, limits: ActorLimits): Promise<ActorRun> {
    this.calls.push({ actor, input, limits });
    return { id: "r", finished_at: null, ...this.answer };
  }
  async billed(): Promise<number | null> {
    return null;
  }
}

const schema = (...fields: string[]) => json({ data: { inputSchema: JSON.stringify({ properties: Object.fromEntries(fields.map((field) => [field, {}])) }) } });

afterEach(() => vi.unstubAllGlobals());

describe("the Apify runner", () => {
  it("checks the input against the actor's schema, starts it with its limits, waits for it and reads its dataset", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("/builds/default")) return schema("keywords");
      if (url.includes("/acts/memo23~keyword-metrics/runs")) return json({ data: { id: "r1", status: "RUNNING", defaultDatasetId: "d1" } });
      if (url.includes("/actor-runs/r1")) return json({ data: { id: "r1", status: "SUCCEEDED", defaultDatasetId: "d1", finishedAt: "2026-10-21T03:15:05Z" } });
      return json([{ keyword: "mullein for lungs", google_search_volume: 6600 }]);
    });
    vi.stubGlobal("fetch", fetch);
    const run = await new ApifyRunner(new ApifyApi(settings), settings).run("memo23/keyword-metrics", { keywords: ["mullein for lungs"] }, { maxTotalChargeUsd: 1, timeoutSeconds: 600, memoryMb: 512 });
    expect(run).toEqual({ id: "r1", status: "SUCCEEDED", items: [{ keyword: "mullein for lungs", google_search_volume: 6600 }], finished_at: "2026-10-21T03:15:05Z" });
    const start = new URL(String(fetch.mock.calls.find(([url]) => String(url).includes("/runs?"))![0]));
    expect(Object.fromEntries(start.searchParams)).toMatchObject({ maxTotalChargeUsd: "1", timeout: "600", memory: "512" });
  });

  it("refuses to run an actor whose input no longer has a field it is sent, so nothing is charged for a silent empty run", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      return schema("scrapingMode", "query", "maxResults");
    }));
    await expect(new ApifyRunner(new ApifyApi(settings), settings).run("coding-doctor-omar/reddit-scraper-pro", { scrapingMode: "keywordSearch", keywordsIncluded: ["mullein"] }, { maxTotalChargeUsd: null, timeoutSeconds: 60, memoryMb: 512 })).rejects.toThrow(
      "coding-doctor-omar/reddit-scraper-pro no longer accepts `keywordsIncluded`: its input changed, so it was not run",
    );
    expect(urls.some((url) => url.includes("/runs?"))).toBe(false);
  });

  it("reads a run's charge only once it has settled: Apify adds per-result charges seconds after the run finishes", async () => {
    const usage = [0, 0.0006, 0.0006];
    vi.stubGlobal("fetch", vi.fn(async () => json({ data: { id: "r3", status: "SUCCEEDED", defaultDatasetId: "d3", usageTotalUsd: usage.shift() } })));
    expect(await new ApifyRunner(new ApifyApi(settings), settings).billed({ id: "r3", status: "SUCCEEDED", items: [], finished_at: new Date().toISOString() })).toBe(0.0006);
    expect(usage).toEqual([]);
  });

  it("aborts a run still going when its wait is over, so it stops spending", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      if (url.endsWith("/abort")) return json({ data: { id: "r2", status: "ABORTING", defaultDatasetId: "d2" } });
      if (url.includes("/builds/default")) return schema();
      if (url.includes("/actor-runs/r2")) return json({ data: { id: "r2", status: urls.some((u) => u.endsWith("/abort")) ? "ABORTED" : "RUNNING", defaultDatasetId: "d2" } });
      if (url.includes("/datasets/")) return json([]);
      return json({ data: { id: "r2", status: "RUNNING", defaultDatasetId: "d2" } });
    }));
    const quick = { ...settings, apifyWaitSeconds: 0 };
    const run = await new ApifyRunner(new ApifyApi(quick), quick).run("coding-doctor-omar/reddit-scraper-pro", {}, { maxTotalChargeUsd: null, timeoutSeconds: 300, memoryMb: 1024 });
    expect(run).toMatchObject({ status: "ABORTED", items: [] });
    expect(urls.some((url) => url.endsWith("/actor-runs/r2/abort"))).toBe(true);
    expect(urls.find((url) => url.includes("/runs?"))).not.toContain("maxTotalChargeUsd");
  });
});

describe("the three actors", () => {
  it("asks memo23 for Google volumes only, Bing being a second billed batch", async () => {
    const runner = new CannedRunner({ status: "SUCCEEDED", items: [{ keyword: "mullein for lungs", google_search_volume: 6600, search_intent: "commercial", trend: "rising" }] });
    expect(await new ApifyKeywordVolumes(runner).volumes(["mullein for lungs"], "us")).toEqual([{ keyword: "mullein for lungs", monthly_searches: 6600, intent: "commercial", trend: "rising" }]);
    expect(runner.calls[0]!.input).toEqual({ mode: "metrics", keywords: ["mullein for lungs"], country: "us", includeGoogle: true, includeBing: false });
  });

  it("reads Amazon listings with sponsored flagged, and searches Reddit with one query expression and its comment defaults capped", async () => {
    const amazon = new CannedRunner({ status: "SUCCEEDED", items: [{ asin: "B0X", title: "Mullein Drops 7-in-1 Lung Detox", url: "https://amazon.com/dp/B0X", keyword: "mullein drops", rating: 4.4, ratingsCount: 2310, price: "$19.99", isSponsored: true, organicPosition: null }] });
    expect((await new ApifyAmazonSearch(amazon).search(["mullein drops"], "us", 30))[0]).toMatchObject({ asin: "B0X", ratings_count: 2310, price: 19.99, sponsored: true, organic_position: null });
    const reddit = new CannedRunner({ status: "SUCCEEDED", items: [{ submissionId: "p1", submissionType: "comment", submissionUrl: "https://reddit.com/r/COPD/p1", subreddit: "r/COPD", title: null, bodyText: "Mullein did nothing for me", score: 4, submittedAt: "2026-08-01T00:00:00Z" }] });
    expect(await new ApifyRedditSearch(reddit).search({ keywords: ["mullein"], maxPosts: 25, commentsPerPost: 15 })).toEqual([{ id: "p1", kind: "comment", url: "https://reddit.com/r/COPD/p1", subreddit: "r/COPD", title: null, body: "Mullein did nothing for me", score: 4, posted_at: "2026-08-01" }]);
    expect(reddit.calls[0]!.input).toEqual({ scrapingMode: "keywordSearch", query: "mullein", maxResults: 25, sort: "default", includeComments: true, maxCommentsDepth: 2, maxCommentsPerPost: 15, maxTopCommentsPerPost: 15 });
    expect(ApifyRedditSearch.expression(["mullein cough", "mullein (smokers)"])).toBe("(mullein cough) OR (mullein  smokers)");
    expect(reddit.calls[0]!.limits.maxTotalChargeUsd).toBeNull();
  });

  it("treats an empty dataset on a run that succeeded as a failure to read, not as no results", async () => {
    await expect(new ApifyKeywordVolumes(new CannedRunner({ status: "SUCCEEDED", items: [] })).volumes(["x"], "us")).rejects.toThrow("failure to read");
    await expect(new ApifyAmazonSearch(new CannedRunner({ status: "TIMED-OUT", items: [] })).search(["x"], "us", 10)).rejects.toThrow("ended TIMED-OUT");
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
