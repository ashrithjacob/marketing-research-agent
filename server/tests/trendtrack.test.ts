/**
 * Trendtrack's Meta ad search (`POST /v1/ads/query`), shaped as measured on
 * 2026-10-02: a persona page's ad names its brand only through
 * `content.landingPageDomain` ("Barbara Collins" → offer.tryhealora.com).
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { Corpus } from "../src/adapters/corpus.js";
import { TrendtrackAds } from "../src/adapters/trendtrack-ads.js";
import { AdLibraryTool, ResearchToolset } from "../src/agent/tools/index.js";
import { ServiceClients } from "../src/adapters/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { ServiceUnavailableError, type AdPage } from "../src/domain/index.js";
import { services } from "./fixtures.js";

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...Env.settings(),
  trendtrackApiKey: "tt-test",
  trendtrackBaseUrl: "https://trendtrack.test",
  ...overrides,
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const persona = {
  id: "facebook_1",
  status: "active",
  firstSeenAt: "2026-05-25T07:00:00.000Z",
  lastSeenAt: "2026-07-14T07:00:00.000Z",
  advertiser: { name: "Barbara Collins", facebookPageId: "99", reach30d: 1682459, liveAdsCount: 559 },
  content: { title: null, body: "Dermatologists found remedy that will eliminate skin fold rash naturally", landingPageUrl: "https://offer.tryhealora.com/adv/7-reasons", landingPageDomain: "offer.tryhealora.com" },
  metrics: { reach: 120000 },
  audience: { targetedCountries: ["GB", "US"] },
};

afterEach(() => vi.unstubAllGlobals());

describe("TrendtrackAds", () => {
  it("asks for Meta ads by reach in the markets given, and keeps the landing domain that names a persona page's brand", async () => {
    const fetch = vi.fn(async () => json(200, { data: [persona], pagination: { total: 4244 } }));
    vi.stubGlobal("fetch", fetch);
    const page = await new TrendtrackAds(settings()).search({ terms: ["skin fold rash"], searchIn: "ad_copy", countries: ["US", "GB"], limit: 5 });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://trendtrack.test/v1/ads/query");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tt-test");
    expect(JSON.parse(String(init.body))).toEqual({
      search: ["skin fold rash"], searchType: "adCopy", keywordMode: "any", sortBy: "reach", order: "desc",
      status: "all", platforms: ["facebook"], adCountries: { include: ["US", "GB"] }, limit: 5,
    });
    expect(page.total).toBe(4244);
    expect(page.hits[0]).toMatchObject({ advertiser: "Barbara Collins", landing_domain: "offer.tryhealora.com", first_seen: "2026-05-25", countries: ["GB", "US"], page_live_ads: 559 });
  });

  it("can answer nothing without a key or credit, and fails only the request otherwise", async () => {
    await expect(new TrendtrackAds(settings({ trendtrackApiKey: "" })).search({ terms: ["x"], searchIn: "brand", countries: [], limit: 1 })).rejects.toBeInstanceOf(ServiceUnavailableError);
    vi.stubGlobal("fetch", vi.fn(async () => json(402, { message: "No credits" })));
    await expect(new TrendtrackAds(settings()).search({ terms: ["x"], searchIn: "brand", countries: [], limit: 1 })).rejects.toBeInstanceOf(ServiceUnavailableError);
    vi.stubGlobal("fetch", vi.fn(async () => json(422, { message: "bad body" })));
    await expect(new TrendtrackAds(settings()).search({ terms: ["x"], searchIn: "brand", countries: [], limit: 1 })).rejects.toThrow(/422: bad body/);
  });
});

describe("ad_library_search", () => {
  const dir = mkdtempSync(join(tmpdir(), "mra-ads-"));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  const hit = { ad_id: "facebook_1", advertiser: "Barbara Collins", page_id: "99", landing_url: "https://offer.tryhealora.com/adv", landing_domain: "offer.tryhealora.com", first_seen: "2026-05-25", last_seen: "2026-07-14", status: "active", countries: ["GB"], body: "Dermatologists found remedy", ad_reach: 120000, page_reach_30d: 1682459, page_live_ads: 559 };

  it("archives the search and every ad, so each ad is citable with its first_seen and the count is citable too", async () => {
    const ads = { search: vi.fn(async (): Promise<AdPage> => ({ hits: [hit], total: 4244 })) };
    const result = await new AdLibraryTool(ads, new Corpus(dir), "run-1").tool().execute("1", { query: "skin fold rash", countries: ["us", "gb"], max_results: 99 });
    expect(ads.search).toHaveBeenCalledWith({ terms: ["skin fold rash"], searchIn: "ad_copy", countries: ["US", "GB"], limit: 20 }, undefined);
    const text = (result.content[0] as any).text as string;
    expect(text).toMatch(/^4244 Meta ads in Trendtrack's index match "skin fold rash" in ad_copy, US, GB; 1 shown, by reach\. This search is archived as source_id sha256:/);
    expect(text).toContain("1. Barbara Collins — lands on offer.tryhealora.com (active, first seen 2026-05-25");
    expect(text).toMatch(/record_source it as kind "ad_library" with first_seen 2026-05-25/);
    const [search, ad] = result.details.sources.map((id: string) => readFileSync(join(dir, "runs", "run-1", "sources", id.replace("sha256:", "")), "utf-8"));
    expect(JSON.parse(search!).total).toBe(4244);
    expect(ad).toContain("landing: https://offer.tryhealora.com/adv");
  });

  it("is offered only to an agent allowed ads, and only when a Trendtrack key built the service", () => {
    const base = settings();
    const names = (opts: Partial<ConstructorParameters<typeof ResearchToolset>[0]>) =>
      new ResearchToolset({ settings: base, runId: "r", services: services(base), ...opts }).build().map((t) => t.name);
    const withAds = new ServiceClients(services(base).pages, services(base).search, null, undefined, null, { search: async () => ({ hits: [], total: 0 }) });
    expect(names({ ads: true })).not.toContain("ad_library_search");
    expect(names({ services: withAds })).not.toContain("ad_library_search");
    expect(names({ services: withAds, ads: true })).toContain("ad_library_search");
  });
});
