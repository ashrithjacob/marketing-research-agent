/**
 * The page-fetch chain: Firecrawl, then Crawl4AI only when Firecrawl can read no
 * page at all. Run 8d5a8325 (2026-09-30) spent 10 minutes and 7 fetches per
 * agent on Firecrawl answering 402 Insufficient Credits to every url.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { Crawl4ai } from "../src/adapters/crawl4ai.js";
import { FallbackPageFetcher } from "../src/adapters/fallback-fetcher.js";
import { Firecrawl } from "../src/adapters/firecrawl.js";
import { ServiceClients } from "../src/adapters/service-clients.js";
import { Env, type Settings } from "../src/config/index.js";
import { ServiceUnavailableError, type PageFetcher } from "../src/domain/index.js";

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...Env.settings(),
  firecrawlApiKey: "fc-key",
  firecrawlBaseUrl: "https://firecrawl.test",
  crawl4aiApiKey: "sk_live_test",
  crawl4aiBaseUrl: "https://crawl4ai.test",
  ...overrides,
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("Crawl4ai", () => {
  it("posts the url for markdown with the bearer key, and returns the page", async () => {
    const fetch = vi.fn(async () => json(200, { markdown: "# Mullein drops", title: "Mullevia" }));
    vi.stubGlobal("fetch", fetch);
    const page = await new Crawl4ai(settings()).scrape("https://mullevia.com/p");
    expect(page).toEqual({ text: "# Mullein drops", title: "Mullevia", reader: "crawl4ai" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://crawl4ai.test/scrape");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_live_test");
    expect(JSON.parse(String(init.body))).toEqual({ url: "https://mullevia.com/p", format: "md" });
  });

  it("says it can fetch nothing on no credit or a rejected key, and fails only the page otherwise", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(402, { error: "no_credit", message: "balance -0.50" })));
    await expect(new Crawl4ai(settings()).scrape("https://a.example")).rejects.toBeInstanceOf(ServiceUnavailableError);
    vi.stubGlobal("fetch", vi.fn(async () => json(401, {})));
    await expect(new Crawl4ai(settings()).scrape("https://a.example")).rejects.toBeInstanceOf(ServiceUnavailableError);
    vi.stubGlobal("fetch", vi.fn(async () => json(403, { error: "blocked" })));
    const blocked = new Crawl4ai(settings()).scrape("https://a.example");
    await expect(blocked).rejects.toThrow(/Crawl4AI returned 403/);
    await expect(blocked).rejects.not.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("Firecrawl out of credits", () => {
  it("is an account that can fetch nothing, not a failed page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(402, { success: false, error: "Insufficient credits" })));
    await expect(new Firecrawl(settings()).scrape("https://a.example")).rejects.toBeInstanceOf(ServiceUnavailableError);
    await expect(new Firecrawl(settings({ firecrawlApiKey: "" })).scrape("https://a.example")).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("FallbackPageFetcher", () => {
  const fetcher = (result: () => Promise<{ text: string; title: string }>): PageFetcher & { calls: number } => {
    const f = { calls: 0, scrape: async () => (f.calls++, (await result())) };
    return f;
  };

  it("reads through Crawl4AI when Firecrawl has no credits", async () => {
    const primary = fetcher(() => Promise.reject(new ServiceUnavailableError("firecrawl", "Firecrawl returned 402")));
    const fallback = fetcher(() => Promise.resolve({ text: "page", title: "t" }));
    expect(await new FallbackPageFetcher(primary, fallback).scrape("https://a.example")).toEqual({ text: "page", title: "t" });
    expect(fallback.calls).toBe(1);
  });

  it("does not use Crawl4AI for a page Firecrawl could not read", async () => {
    const primary = fetcher(() => Promise.reject(new Error("Firecrawl returned 404: not found")));
    const fallback = fetcher(() => Promise.resolve({ text: "page", title: "t" }));
    await expect(new FallbackPageFetcher(primary, fallback).scrape("https://a.example")).rejects.toThrow(/404/);
    expect(fallback.calls).toBe(0);
  });

  it("does not touch Crawl4AI while Firecrawl works", async () => {
    const primary = fetcher(() => Promise.resolve({ text: "fc", title: "" }));
    const fallback = fetcher(() => Promise.resolve({ text: "c4", title: "" }));
    expect((await new FallbackPageFetcher(primary, fallback).scrape("https://a.example")).text).toBe("fc");
    expect(fallback.calls).toBe(0);
  });
});

describe("the chain the app builds", () => {
  it("tries Firecrawl, then Crawl4AI", async () => {
    const hosts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(String(input));
      hosts.push(url.host);
      if (url.host === "firecrawl.test") return json(402, { success: false, error: "Insufficient credits" });
      return json(200, { markdown: "# read by crawl4ai" });
    }));
    const page = await ServiceClients.forSettings(settings()).pages.scrape("https://a.example");
    expect(page.text).toBe("# read by crawl4ai");
    expect(hosts).toEqual(["firecrawl.test", "crawl4ai.test"]);
  });

  it("is Firecrawl alone when Crawl4AI has no key", async () => {
    const hosts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      hosts.push(new URL(String(input)).host);
      return json(402, { success: false, error: "Insufficient credits" });
    }));
    await expect(ServiceClients.forSettings(settings({ crawl4aiApiKey: "" })).pages.scrape("https://a.example")).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(hosts).toEqual(["firecrawl.test"]);
  });
});
