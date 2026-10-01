/**
 * Parallel Search and Extract, the services product truth reads with
 * (spec-stage-2-product-truth.md §5). The request shapes are the ones measured
 * against the live API on 2026-10-01: `max_results` and `source_policy` go in
 * `advanced_settings` (top level is a 422), and Extract needs the beta header.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { FallbackWebSearch } from "../src/adapters/fallback-search.js";
import { ParallelApi } from "../src/adapters/parallel-api.js";
import { ParallelExtract } from "../src/adapters/parallel-extract.js";
import { ParallelSearch } from "../src/adapters/parallel-search.js";
import { Searxng } from "../src/adapters/searxng.js";
import { Env, type Settings } from "../src/config/index.js";
import { Domains, ServiceUnavailableError, type SearchPage, type WebSearch } from "../src/domain/index.js";

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...Env.settings(),
  parallelApiKey: "pk-test",
  parallelBaseUrl: "https://parallel.test",
  searxngUrl: "https://searxng.test",
  ...overrides,
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("ParallelSearch", () => {
  it("asks with the key, puts max_results and the site list in advanced_settings, and returns the excerpts as citable text", async () => {
    const fetch = vi.fn(async () =>
      json(200, { results: [{ url: "https://pmc.ncbi.nlm.nih.gov/a", title: "Bromelain RCT", excerpts: ["600 mg daily", "for 14 days"] }] }),
    );
    vi.stubGlobal("fetch", fetch);
    const page = await new ParallelSearch(new ParallelApi(settings())).find("bromelain clinical dose", 3, undefined, { domains: ["ftc.gov"] });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://parallel.test/v1/search");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("pk-test");
    expect(JSON.parse(String(init.body))).toEqual({
      objective: "bromelain clinical dose",
      search_queries: ["bromelain clinical dose"],
      advanced_settings: { max_results: 3, source_policy: { include_domains: ["ftc.gov"] } },
    });
    expect(page.excerpted).toBe(true);
    expect(page.hits).toEqual([{ title: "Bromelain RCT", url: "https://pmc.ncbi.nlm.nih.gov/a", snippet: "600 mg daily\n\n...\n\nfor 14 days" }]);
  });

  it("sends no source_policy for an unscoped search", async () => {
    const fetch = vi.fn(async () => json(200, { results: [] }));
    vi.stubGlobal("fetch", fetch);
    await new ParallelSearch(new ParallelApi(settings())).find("mullein", 5);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).advanced_settings).toEqual({ max_results: 5 });
  });

  it("says it can answer nothing with no key, a rejected key or no credit, and fails only the request otherwise", async () => {
    await expect(new ParallelSearch(new ParallelApi(settings({ parallelApiKey: "" }))).find("x", 1)).rejects.toBeInstanceOf(ServiceUnavailableError);
    vi.stubGlobal("fetch", vi.fn(async () => json(401, { code: 16, message: "Invalid API key (C.1)" })));
    await expect(new ParallelSearch(new ParallelApi(settings())).find("x", 1)).rejects.toBeInstanceOf(ServiceUnavailableError);
    vi.stubGlobal("fetch", vi.fn(async () => json(422, { type: "error", error: { message: "Request validation error." } })));
    const failed = new ParallelSearch(new ParallelApi(settings())).find("x", 1);
    await expect(failed).rejects.toThrow(/422: Request validation error/);
    await expect(failed).rejects.not.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("ParallelExtract", () => {
  it("reads the page in full through the beta endpoint", async () => {
    const fetch = vi.fn(async () => json(200, { results: [{ url: "https://mullevia.com/p", title: "Mullevia", full_content: "$26.95 one bottle" }], errors: [] }));
    vi.stubGlobal("fetch", fetch);
    const page = await new ParallelExtract(new ParallelApi(settings())).scrape("https://mullevia.com/p");
    expect(page).toEqual({ text: "$26.95 one bottle", title: "Mullevia" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://parallel.test/v1beta/extract");
    expect((init.headers as Record<string, string>)["parallel-beta"]).toBe("search-extract-2025-10-10");
    expect(JSON.parse(String(init.body))).toEqual({ urls: ["https://mullevia.com/p"], excerpts: false, full_content: true });
  });

  it("fails the page, not the service, on a url it could not reach", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { results: [], errors: [{ url: "https://x.invalid", error_type: "connect_error", http_status_code: null }] })));
    const failed = new ParallelExtract(new ParallelApi(settings())).scrape("https://x.invalid");
    await expect(failed).rejects.toThrow(/could not read this url: connect_error/);
    await expect(failed).rejects.not.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("FallbackWebSearch", () => {
  const page = (service: string): SearchPage => ({ hits: [], excerpted: false, report: { service, outcome: "ok", parts: [] } });

  it("goes to the fallback only when the primary can answer nothing at all", async () => {
    const fallback: WebSearch = { find: vi.fn(async () => page("SearXNG")) };
    const dead: WebSearch = { find: async () => { throw new ServiceUnavailableError("parallel", "402"); } };
    expect((await new FallbackWebSearch(dead, fallback).find("q", 3, undefined, { domains: ["fda.gov"] })).report.service).toBe("SearXNG");
    expect(fallback.find).toHaveBeenCalledWith("q", 3, undefined, { domains: ["fda.gov"] });

    const broken: WebSearch = { find: async () => { throw new Error("500"); } };
    await expect(new FallbackWebSearch(broken, fallback).find("q", 3)).rejects.toThrow("500");
  });
});

describe("a scoped search on SearXNG", () => {
  it("keeps only hits on the scope's sites, subdomains included, since SearXNG has no site filter", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      json(200, { results: [
        { url: "https://www.fda.gov/food/x", title: "FDA", content: "a" },
        { url: "https://blog.example/fda.gov-claims", title: "Blog", content: "b" },
        { url: "https://consumer.ftc.gov/y", title: "FTC", content: "c" },
      ] }),
    ));
    const found = await new Searxng(settings()).find("supplement claims", 10, undefined, { domains: ["fda.gov", "ftc.gov"] });
    expect(found.hits.map((hit) => hit.title)).toEqual(["FDA", "FTC"]);
    expect(found.excerpted).toBe(false);
  });

  it("matches a site exactly or as a parent domain, never as a substring", () => {
    expect(Domains.within("https://asa.org.uk/x", ["asa.org.uk"])).toBe(true);
    expect(Domains.within("https://notasa.org.uk/x", ["asa.org.uk"])).toBe(false);
    expect(Domains.within("https://anything.example", undefined)).toBe(true);
  });
});
