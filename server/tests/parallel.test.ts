/**
 * Parallel Search and Extract, the services product truth reads with
 * (spec-stage-2-product-truth.md §5). The request shapes are the ones measured
 * against the live API on 2026-10-01: `max_results` and `source_policy` go in
 * `advanced_settings` (top level is a 422), and Extract needs the beta header.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { ParallelApi } from "../src/adapters/parallel-api.js";
import { ParallelExtract } from "../src/adapters/parallel-extract.js";
import { ParallelCompetitorDiscovery } from "../src/adapters/parallel-discovery.js";
import { ParallelSearch } from "../src/adapters/parallel-search.js";
import { ParallelTask } from "../src/adapters/parallel-task.js";
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

describe("ParallelExtract", () => {
  it("reads the page in full through the beta endpoint", async () => {
    const fetch = vi.fn(async () => json(200, { results: [{ url: "https://mullevia.com/p", title: "Mullevia", full_content: "$26.95 one bottle" }], errors: [] }));
    vi.stubGlobal("fetch", fetch);
    const page = await new ParallelExtract(new ParallelApi(settings())).scrape("https://mullevia.com/p");
    expect(page).toEqual({ text: "$26.95 one bottle", title: "Mullevia", reader: "parallel_extract" });
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

describe("ParallelTask", () => {
  const replies = (...bodies: Array<[number, unknown] | Error>) => {
    const fetch = vi.fn(async () => {
      const next = bodies.shift()!;
      if (next instanceof Error) throw next;
      return json(next[0], next[1]);
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  };

  it("creates a run, polls its status until completed, and reads the result", async () => {
    const fetch = replies([202, { run_id: "trun_1", status: "queued" }], [200, { status: "running" }], [200, { status: "completed" }], [200, { output: { content: {} } }]);
    const { runId, result } = await new ParallelTask(new ParallelApi(settings()), 0, 60).run({ processor: "pro" });
    expect(runId).toBe("trun_1");
    expect(result).toEqual({ output: { content: {} } });
    const urls = fetch.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(urls).toEqual([
      "https://parallel.test/v1/tasks/runs",
      "https://parallel.test/v1/tasks/runs/trun_1",
      "https://parallel.test/v1/tasks/runs/trun_1",
      "https://parallel.test/v1/tasks/runs/trun_1/result",
    ]);
  });

  it("asks the status again when one read fails in transit, as a poll on 2026-10-02 did with 'fetch failed'", async () => {
    replies([202, { run_id: "trun_2" }], new TypeError("fetch failed"), [200, { status: "completed" }], [200, { output: {} }]);
    expect((await new ParallelTask(new ParallelApi(settings()), 0, 60).run({})).runId).toBe("trun_2");
  });

  it("fails on a failed run, and stops at once when Parallel can answer nothing", async () => {
    replies([202, { run_id: "trun_3" }], [200, { status: "failed" }]);
    await expect(new ParallelTask(new ParallelApi(settings()), 0, 60).run({})).rejects.toThrow(/trun_3 ended failed/);
    replies([202, { run_id: "trun_4" }], [402, { message: "Insufficient credit" }]);
    await expect(new ParallelTask(new ParallelApi(settings()), 0, 60).run({})).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("ParallelCompetitorDiscovery", () => {
  it("asks about the champion's customer and returns each brand with the page Parallel cited for it", async () => {
    const task = { run: vi.fn(async () => ({
      runId: "trun_9",
      result: { output: {
        content: { competitors: [{ brand: "PureCrest", name: "PureCrest", url: "https://trypurecrest.com/", form: "Cream", market: "US", icp_as_printed: "under the breasts" }] },
        basis: [{ field: "competitors.0", citations: [{ url: "https://trypurecrest.com/", excerpts: ["Zinc Oxide 15%"] }] }],
      } },
    })) };
    const question = { product: "Healora Intertrigo Relief Cream", url: "https://healora.com", icp: "adults with skin-fold rash", form: "topical", actives: ["Zinc Oxide (15%)"], markets: "US, UK" };
    const report = await new ParallelCompetitorDiscovery(task as unknown as ParallelTask, "pro").discover(question);
    const body = (task.run.mock.calls[0] as unknown as [Record<string, any>])[0];
    expect(body.processor).toBe("pro");
    expect(body.input).toContain("Its customer, as its own page puts it: adults with skin-fold rash.");
    expect(body.task_spec.output_schema.json_schema.properties.competitors.description).toMatch(/not a competitor, even when it shares an ingredient/);
    expect(report).toEqual({
      processor: "pro",
      taskRunId: "trun_9",
      candidates: [{ brand: "PureCrest", name: "PureCrest", url: "https://trypurecrest.com/", form: "Cream", market: "US", icp_as_printed: "under the breasts", evidence_url: "https://trypurecrest.com/", evidence: "Zinc Oxide 15%" }],
    });
  });
});
