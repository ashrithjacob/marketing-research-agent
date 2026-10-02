/**
 * What each agent costs (spec-research-agent-factory.md §8). Every paid call
 * writes one charge, tagged with the agent whose tool made it, and the report
 * sums them with OpenRouter's billed cost per call.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MeteredAdLibrary, MeteredDiscovery, MeteredPageFetcher, MeteredWebSearch, ServiceClients, SqliteResearchStore } from "../src/adapters/index.js";
import { ParallelApi } from "../src/adapters/parallel-api.js";
import { ParallelSearch } from "../src/adapters/parallel-search.js";
import { TrendtrackAds } from "../src/adapters/trendtrack-ads.js";
import { LiveRuns, RunMeter } from "../src/agent/index.js";
import { ToolRegistry } from "../src/agent/tools/index.js";
import { Env, type ServicePrices, type Settings } from "../src/config/index.js";
import type { ChargeDraft, LlmCall } from "../src/domain/index.js";
import { CostReports } from "../src/extract/index.js";

const prices: ServicePrices = {
  parallelSearchUsd: 0.005,
  parallelExtractUsd: 0.001,
  parallelTaskUsd: { pro: 0.1, ultra: 0.3 },
  trendtrackUsdPerCredit: 0.0089,
  crawl4aiUsdPerPage: 0,
  firecrawlUsdPerPage: null,
};

/** A meter that keeps what it is told. */
function meter(): { charge: (draft: ChargeDraft) => void; drafts: ChargeDraft[] } {
  const drafts: ChargeDraft[] = [];
  return { charge: (draft) => drafts.push(draft), drafts };
}

const page = { hits: [], excerpted: true, report: { service: "Parallel", outcome: "ok" as const, parts: [] } };

afterEach(() => vi.unstubAllGlobals());

describe("the metered wrappers", () => {
  it("charges a Parallel search the units it reports, at the listed price", async () => {
    const m = meter();
    await new MeteredWebSearch({ find: async () => ({ ...page, use: { item: "sku_search", units: 1 } }) }, prices, m).find("q", 5);
    expect(m.drafts).toEqual([{ service: "parallel", item: "sku_search", units: 1, usd: 0.005, basis: "listed" }]);
  });

  it("charges a page to the reader that served it: Extract and Crawl4AI priced, Firecrawl unpriced, a page with no reader not at all", async () => {
    const m = meter();
    for (const reader of ["parallel_extract", "crawl4ai", "firecrawl", undefined] as const) {
      await new MeteredPageFetcher({ scrape: async () => ({ text: "t", title: "", ...(reader ? { reader } : {}) }) }, prices, m).scrape("https://x");
    }
    expect(m.drafts.map((d) => [d.service, d.item, d.usd])).toEqual([["parallel", "extract", 0.001], ["crawl4ai", "page", 0], ["firecrawl", "page", null]]);
  });

  it("charges a Trendtrack search the credits its header reports, valued per credit", async () => {
    const m = meter();
    await new MeteredAdLibrary({ search: async () => ({ hits: [], total: 0, credits: 10 }) }, prices, m).search({ terms: ["x"], searchIn: "ad_copy", countries: [], limit: 10 });
    expect(m.drafts).toEqual([{ service: "trendtrack", item: "ads", units: 10, usd: 10 * 0.0089, basis: "credits" }]);
  });

  it("charges a Task run its processor's listed price, and an unlisted processor as unpriced", async () => {
    const m = meter();
    for (const processor of ["pro", "lite"]) {
      await new MeteredDiscovery({ discover: async () => ({ candidates: [], processor, taskRunId: "t" }) }, prices, m).discover({ product: "", url: "", icp: "", form: "", actives: [], markets: "" });
    }
    expect(m.drafts.map((d) => [d.item, d.usd])).toEqual([["task:pro", 0.1], ["task:lite", null]]);
  });
});

describe("what the services report", () => {
  it("reads Parallel's usage counts off a search", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ results: [], usage: [{ name: "sku_search", count: 1 }] }), { status: 200 })));
    const settings: Settings = { ...Env.settings(), parallelApiKey: "k", parallelBaseUrl: "https://parallel.test" };
    expect((await new ParallelSearch(new ParallelApi(settings)).find("q", 3)).use).toEqual({ item: "sku_search", units: 1 });
  });

  it("reads Trendtrack's credits from its x-credits-used header", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "a" }, { id: "b" }] }), { status: 200, headers: { "x-credits-used": "2" } })));
    const settings: Settings = { ...Env.settings(), trendtrackApiKey: "k" };
    expect((await new TrendtrackAds(settings).search({ terms: ["x"], searchIn: "ad_copy", countries: [], limit: 2 })).credits).toBe(2);
  });
});

describe("a charge's agent", () => {
  let dir: string;
  let store: SqliteResearchStore;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mra-charges-"));
    store = new SqliteResearchStore(join(dir, "research.db"));
  });
  afterEach(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("is the agent whose tool made the call, written to the run's charges and told to the cockpit", async () => {
    const runId = store.createRun({ workspaceId: "admin", brief: { product: "x" }, model: "m", rejectKinds: [], judgementIds: [] }).id;
    const runs = new LiveRuns(store);
    const settings: Settings = { ...Env.settings(), prices, corpusPath: join(dir, "corpus") };
    const search = { find: async () => ({ ...page, use: { item: "sku_search", units: 2 } }) };
    const svc = new ServiceClients({ scrape: async () => ({ text: "", title: "" }) }, search, null);
    const [built] = new ToolRegistry(svc, settings).build(["web_search"], { runId, subject: "", market: "", discovery: null, meter: new RunMeter(store, runs, runId, "competitors") });
    await built!.tool.execute("1", { query: "best cough drops" });
    expect(store.charges.list(runId).map((c) => [c.agent_id, c.service, c.units, c.usd, c.basis])).toEqual([["competitors", "parallel", 2, 0.01, "listed"]]);
    expect(store.listEvents(runId).filter((e) => e.kind === "run.charged").map((e) => e.payload.agent_id)).toEqual(["competitors"]);
  });
});

describe("the cost report", () => {
  const call = (agent_id: string, billed_cost: number | null) => ({ agent_id, billed_cost }) as LlmCall;
  const charge = (agent_id: string | null, service: "parallel" | "apify" | "crawl4ai", usd: number | null, item = "x") =>
    ({ run_id: "r", agent_id, service, item, units: 1, usd, basis: service === "apify" ? "billed" : "listed", created_at: "" }) as const;

  it("gives each agent the columns of its tools, the run its own row, and sums billed LLM turns", () => {
    const report = CostReports.of(
      [call("champion", 0.002), call("competitors", 0.01), call("competitors", null)],
      [charge("competitors", "parallel", 0.1, "task:pro"), charge("competitors", "crawl4ai", 0), charge(null, "apify", 0.01)],
    );
    expect(report.rows.map((row) => [row.agent_id, Object.keys(row.cells)])).toEqual([
      ["champion", ["llm", "apify", "parallel", "page_reading"]],
      ["competitors", ["llm", "apify", "parallel", "trendtrack", "page_reading"]],
      [null, ["apify"]],
    ]);
    const competitors = report.rows[1]!;
    expect(competitors.cells.llm).toEqual({ usd: 0.01, units: 2, detail: "billed 1 of 2 turns" });
    expect(competitors.cells.apify).toMatchObject({ usd: 0, units: 0 });
    expect(competitors.total_usd).toBeCloseTo(0.11, 10);
    expect(report.total_usd).toBeCloseTo(0.002 + 0.11 + 0.01, 10);
  });

  it("leaves a column's dollars null when any unit in it is unpriced, and adds nothing for it", () => {
    const report = CostReports.of([], [{ run_id: "r", agent_id: "product", service: "firecrawl", item: "page", units: 1, usd: null, basis: "listed", created_at: "" }]);
    expect(report.rows[0]!.cells.page_reading).toMatchObject({ usd: null, units: 1 });
    expect(report.totals.page_reading!.usd).toBeNull();
    expect(report.total_usd).toBe(0);
  });
});

describe("prices", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("default to the measured list prices, and a plan change is a config change", () => {
    expect(Env.settings().prices).toEqual({ ...prices });
    vi.stubEnv("MRA_PARALLEL_TASK_USD", "pro=0.2,ultra=0.6");
    vi.stubEnv("MRA_FIRECRAWL_USD_PER_PAGE", "0.00083");
    expect(Env.settings().prices).toMatchObject({ parallelTaskUsd: { pro: 0.2, ultra: 0.6 }, firecrawlUsdPerPage: 0.00083 });
    vi.stubEnv("MRA_PARALLEL_TASK_USD", "pro");
    expect(() => Env.settings()).toThrow(/name=number pairs/);
  });
});
