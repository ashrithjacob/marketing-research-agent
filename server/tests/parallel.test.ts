/**
 * Parallel Search, which every agent's web_search goes to. The request shape is
 * the one measured against the live API on 2026-10-01: `max_results` and
 * `source_policy` go in `advanced_settings` (top level is a 422).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { ParallelApi } from "../src/adapters/parallel-api.js";
import { ParallelSearch } from "../src/adapters/parallel-search.js";
import { Env, type Settings } from "../src/config/index.js";
import { ServiceUnavailableError } from "../src/domain/index.js";

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...Env.settings(),
  parallelApiKey: "pk-test",
  parallelBaseUrl: "https://parallel.test",
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
