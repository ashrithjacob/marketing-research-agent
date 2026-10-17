/**
 * Trendtrack's Meta ad search (`POST /v1/ads/query`), shaped as measured on
 * 2026-10-02: a persona page's ad names its brand only through
 * `content.landingPageDomain` ("Barbara Collins" → offer.tryhealora.com).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceClients } from "../src/adapters/index.js";
import { TrendtrackAds } from "../src/adapters/trendtrack-ads.js";
import { Toolbox } from "../src/agent/index.js";
import { AdSearchTool } from "../src/agent/tools/ad-search-tool.js";
import { UrlLedger } from "../src/agent/tools/url-ledger.js";
import { Env, type Settings } from "../src/config/index.js";
import { ServiceUnavailableError, type AdPage, type ChargeMeter } from "../src/domain/index.js";

import { FakeWeb } from "./fakes.js";

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

describe("ad_search", () => {
  const hit = { ad_id: "facebook_1", advertiser: "Barbara Collins", page_id: "99", landing_url: "https://offer.tryhealora.com/adv", landing_domain: "offer.tryhealora.com", first_seen: "2026-05-25", last_seen: "2026-07-14", status: "active", countries: ["GB"], body: "Dermatologists found remedy", ad_reach: 120000, page_reach_30d: 1682459, page_live_ads: 559 };
  const meter: ChargeMeter = { charge: async () => undefined };

  it("searches in the run's countries, caps the count at 20, and lets the agent cite each ad's landing page", async () => {
    const ads = { search: vi.fn(async (): Promise<AdPage> => ({ hits: [hit], total: 4244 })) };
    const urls = new UrlLedger();
    const result = await new AdSearchTool(ads, ["US", "GB"], urls).tool().execute("1", { query: "skin fold rash", max_results: 99 });
    expect(ads.search).toHaveBeenCalledWith({ terms: ["skin fold rash"], searchIn: "ad_copy", countries: ["US", "GB"], limit: 20 }, undefined);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/^4244 ads match; 1 shown\./);
    expect(text).toContain("1. Barbara Collins, lands on offer.tryhealora.com (active, first seen 2026-05-25");
    expect(urls.unknown([hit.landing_url])).toEqual([]);
  });

  it("is offered only when a Trendtrack key built the service", () => {
    const web = new FakeWeb();
    const names = (services: ServiceClients) => new Toolbox(services, settings()).kit(["web_search", "ad_search"], meter, ["US"]).tools.map((tool) => tool.name);
    expect(names(new ServiceClients(web, web, null))).toEqual(["web_search"]);
    expect(names(new ServiceClients(web, web, web))).toEqual(["web_search", "ad_search"]);
  });
});
