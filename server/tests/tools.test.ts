/**
 * The agent's two tools.
 *
 * `fetch` is stubbed, so these test our handling of the two services rather than
 * the services themselves. The one thing that must be exactly right is the
 * source id: `GET /runs/:id/sources/:sha` re-hashes the archived file and
 * reports whether it still matches, so an id computed over anything other than
 * the bytes written turns that audit into a permanent false negative.
 */

import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { Corpus } from "../src/adapters/corpus.js";
import { Firecrawl } from "../src/adapters/firecrawl.js";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AMAZON_REVIEWS_ACTOR,
  Spend,
  TRUSTPILOT_ACTOR,
} from "../src/adapters/apify/index.js";
import { Env, type Settings } from "../src/config/index.js";
import {
  DiscoverCompetitorsTool,
  LedgerToolset,
  ToolRegistry,
  WebFetchTool,
  type ToolContext,
} from "../src/agent/tools/index.js";
import { AgentRoster, DoneChecks, RunFindings } from "../src/agent/index.js";
import { ServiceClients } from "../src/adapters/index.js";
import {
  STAGE_NODES,
  RoleRecords,
  Roles,
  StageOnePlans,
  locatorSchema,
  NoCharges,
  type DiscoveryQuestion,
  type Node,
  type StageOneAgent,
  type ToolName,
} from "../src/domain/index.js";
import { MemoryLedger, minimalPacket, productPacket, reviewPacket, services } from "./fixtures.js";

let dir: string;
let settings: Settings;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-tools-"));
  settings = {
    ...Env.settings(),
    corpusPath: join(dir, "corpus"),
    parallelApiKey: "pk-test",
    parallelBaseUrl: "https://parallel.test",
    firecrawlApiKey: "test-key",
    firecrawlBaseUrl: "https://firecrawl.test",
    fetchCharLimit: 100,
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

/** The research tools a role naming `names` is built with, as the agent gets them. */
const research = (svc: ServiceClients, names: readonly ToolName[], run: Partial<ToolContext> = {}) =>
  new ToolRegistry(svc, settings).build(names, { runId: "r", subject: "", market: "", discovery: null, meter: new NoCharges(), ...run }).map((built) => built.tool);

const tools = (runId = "run-1") => {
  const list = research(services(settings), ["web_search", "web_fetch"], { runId });
  return {
    search: list.find((t) => t.name === "web_search")!,
    fetch: list.find((t) => t.name === "web_fetch")!,
  };
};

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (input: any, init?: RequestInit) => handler(String(input), init)));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("web_search", () => {
  const sent = (init?: RequestInit) => JSON.parse(String(init?.body));

  it("searches through Parallel and shows each hit's excerpts", async () => {
    stubFetch((url, init) => {
      expect(url).toBe("https://parallel.test/v1/search");
      expect(sent(init).search_queries).toEqual(["magnesium"]);
      return json({
        results: [
          { title: "A", url: "https://a.example", excerpts: ["excerpt a"] },
          { title: "B", url: "https://b.example", excerpts: ["excerpt b"] },
        ],
      });
    });
    const result = await tools().search.execute("1", { query: "magnesium" });
    expect(result.details.hits).toHaveLength(2);
    expect((result.content[0] as any).text).toContain("https://a.example");
    expect((result.content[0] as any).text).toContain("excerpt a");
  });

  it("honours max_results and clamps it", async () => {
    const asked: number[] = [];
    stubFetch((_url, init) => {
      asked.push(sent(init).advanced_settings.max_results);
      return json({ results: [] });
    });
    await tools().search.execute("1", { query: "x", max_results: 3 });
    await tools().search.execute("1", { query: "x", max_results: 99 });
    expect(asked).toEqual([3, 25]);
  });

  it("says so plainly when there are no results", async () => {
    stubFetch(() => json({ results: [] }));
    const result = await tools().search.execute("1", { query: "nothing" });
    expect((result.content[0] as any).text).toMatch(/No results/);
  });

  it("throws when search is down rather than answering 'No results'", async () => {
    stubFetch(() => json({ message: "Insufficient credit" }, 402));
    await expect(tools().search.execute("1", { query: "x" })).rejects.toThrow(/402/);
    settings = { ...settings, parallelApiKey: "" };
    await expect(tools().search.execute("1", { query: "x" })).rejects.toThrow(/PARALLEL_API_KEY is not set/);
  });
});

describe("discover_competitors", () => {
  const question = { product: "Healora", url: "https://healora.com", icp: "adults with skin-fold rash", form: "topical", actives: ["Zinc Oxide (15%)"], markets: "US" };
  const report = {
    processor: "pro",
    taskRunId: "trun_1",
    candidates: [{ brand: "PureCrest", name: "PureCrest", url: "https://trypurecrest.com/", form: "Cream", market: "US", icp_as_printed: "under the breasts", evidence_url: "https://trypurecrest.com/", evidence: "" }],
  };

  it("hands back candidates to fetch, archived as a citable source, and asks Parallel only once", async () => {
    const discovery = { discover: vi.fn(async () => report) };
    const tool = new DiscoverCompetitorsTool(discovery, question, new Corpus(settings.corpusPath), "run-3").tool();
    const first = await tool.execute("1", {});
    const text = (first.content[0] as any).text as string;
    expect(text).toMatch(/1 candidates from Parallel \(processor pro, task run trun_1\)/);
    expect(text).toMatch(/A candidate is not a competitor: web_fetch its own page/);
    expect(text).toContain("1. PureCrest — PureCrest (Cream, US)\n   https://trypurecrest.com/\n   for: under the breasts");
    const digest = first.details.source_id.replace("sha256:", "");
    expect(JSON.parse(readFileSync(join(settings.corpusPath, "runs", "run-3", "sources", digest), "utf-8")).taskRunId).toBe("trun_1");
    const second = await tool.execute("2", {});
    expect((second.content[0] as any).text).toMatch(/^Already asked this run; the same list/);
    expect(discovery.discover).toHaveBeenCalledTimes(1);
  });

  it("asks again after a failure rather than repeating the error", async () => {
    const discovery = { discover: vi.fn().mockRejectedValueOnce(new Error("Parallel returned 500")).mockResolvedValueOnce(report) };
    const tool = new DiscoverCompetitorsTool(discovery, question, new Corpus(settings.corpusPath), "run-4").tool();
    await expect(tool.execute("1", {})).rejects.toThrow(/500/);
    expect((await tool.execute("2", {})).details.candidates).toHaveLength(1);
  });

  it("is offered only to an agent given a question, and only with a discovery service", () => {
    const names = (svc: ServiceClients, discovery: DiscoveryQuestion | null) =>
      research(svc, Roles.of("competitors").tools, { discovery }).map((t) => t.name);
    const withDiscovery = new ServiceClients(services(settings).pages, services(settings).search, null, undefined, { discover: async () => report });
    expect(names(services(settings), question)).not.toContain("discover_competitors");
    expect(names(withDiscovery, null)).not.toContain("discover_competitors");
    expect(names(withDiscovery, question)).toContain("discover_competitors");
    expect(research(withDiscovery, Roles.of("product").tools, { discovery: question }).map((t) => t.name)).not.toContain("discover_competitors");
  });
});

describe("web_fetch", () => {
  const page = (markdown: string, title = "A page") =>
    json({ success: true, data: { markdown, metadata: { title } } });

  it("archives the body and hands back an id that still hashes to it", async () => {
    const body = "the readable text of the page";
    stubFetch(() => page(body));
    const result = await tools("run-7").fetch.execute("1", { url: "https://a.example" });

    expect(result.details.archived).toBe(true);
    const digest = result.details.source_id.replace("sha256:", "");
    const written = readFileSync(join(settings.corpusPath, "runs", "run-7", "sources", digest));
    expect(createHash("sha256").update(written).digest("hex")).toBe(digest);
    expect(written.toString("utf-8")).toBe(body);
  });

  it("puts the id and the archived flag where the agent will read them", async () => {
    stubFetch(() => page("text"));
    const text = (await tools().fetch.execute("1", { url: "https://a.example" }))
      .content[0] as any;
    expect(text.text).toMatch(/^source_id: sha256:[0-9a-f]{64}$/m);
    expect(text.text).toMatch(/^archived: true$/m);
  });

  it("shows the model at most 25 000 characters of a page by default", () => {
    // At 60 000, four Amazon listings a batch took a run to 208k input tokens,
    // and it ended without ever writing its packet.
    const saved = process.env.MRA_FETCH_CHAR_LIMIT;
    delete process.env.MRA_FETCH_CHAR_LIMIT;
    try {
      expect(Env.settings().fetchCharLimit).toBe(25000);
    } finally {
      if (saved !== undefined) process.env.MRA_FETCH_CHAR_LIMIT = saved;
    }
  });

  it("truncates what the model reads but never what is archived", async () => {
    const body = "x".repeat(500);
    stubFetch(() => page(body));
    const result = await tools("run-8").fetch.execute("1", { url: "https://a.example" });

    expect(result.details.truncated).toBe(true);
    expect(result.details.chars).toBe(500);
    expect((result.content[0] as any).text).toMatch(/showing the first 100 of 500 characters/);
    const digest = result.details.source_id.replace("sha256:", "");
    const written = readFileSync(join(settings.corpusPath, "runs", "run-8", "sources", digest));
    expect(written.length).toBe(500);
  });

  it("reports archived: false rather than failing when the corpus is unwritable", async () => {
    // The run is not blocked by a missing corpus volume — the source becomes a gap.
    stubFetch(() => page("text"));
    // A regular file where the corpus directory should be: mkdir under it fails
    // with ENOTDIR, which is the same shape as the volume simply not being there.
    const blocked = join(dir, "not-a-directory");
    writeFileSync(blocked, "");
    settings = { ...settings, corpusPath: blocked };
    const result = await tools().fetch.execute("1", { url: "https://a.example" });
    expect(result.details.archived).toBe(false);
    expect((result.content[0] as any).text).toMatch(/corpus volume could not be written/);
  });

  it("refuses to run without a Firecrawl key instead of returning nothing", async () => {
    settings = { ...settings, firecrawlApiKey: "" };
    await expect(tools().fetch.execute("1", { url: "https://a.example" })).rejects.toThrow(
      /FIRECRAWL_API_KEY/,
    );
  });

  it("treats an empty body as a failure", async () => {
    stubFetch(() => page("   "));
    await expect(tools().fetch.execute("1", { url: "https://a.example" })).rejects.toThrow(
      /empty body/,
    );
  });

  it("surfaces a Firecrawl error, and does not retry a 429 that names no wait", async () => {
    let asked = 0;
    stubFetch(() => {
      asked += 1;
      return json({ success: false, error: "rate limited" }, 429);
    });
    await expect(tools().fetch.execute("1", { url: "https://a.example" })).rejects.toThrow(
      /rate limited/,
    );
    expect(asked).toBe(1);
  });
});

describe("Firecrawl's rate limit", () => {
  const limited = (seconds: number) =>
    json(
      {
        success: false,
        error: `Rate limit exceeded. Consumed (req/min): 12, Remaining (req/min): 0. Upgrade your plan at https://firecrawl.dev/pricing for increased rate limits or please retry after ${seconds}s, resets at Mon Sep 28 2026 08:28:46 GMT+0000 (Coordinated Universal Time)`,
      },
      429,
    );
  const page = () => json({ success: true, data: { markdown: "# page", metadata: { title: "T" } } });

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits 120% of the time Firecrawl names, then reads the page", async () => {
    const at: number[] = [];
    stubFetch(() => {
      at.push(Date.now());
      return at.length === 1 ? limited(11) : page();
    });
    const reading = new Firecrawl(settings).scrape("https://a.example");
    await vi.advanceTimersByTimeAsync(13_199);
    expect(at).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(reading).resolves.toEqual({ text: "# page", title: "T", reader: "firecrawl" });
    expect(at[1]! - at[0]!).toBe(13_200);
  });

  it("prefers a Retry-After header when Firecrawl sends one", async () => {
    const at: number[] = [];
    stubFetch(() => {
      at.push(Date.now());
      if (at.length > 1) return page();
      return new Response(JSON.stringify({ success: false, error: "please retry after 11s" }), {
        status: 429,
        headers: { "Retry-After": "5" },
      });
    });
    const reading = new Firecrawl(settings).scrape("https://a.example");
    await vi.advanceTimersByTimeAsync(6_000);
    await reading;
    expect(at[1]! - at[0]!).toBe(6_000);
  });

  it("gives up after two retries, with Firecrawl's own error", async () => {
    let asked = 0;
    stubFetch(() => {
      asked += 1;
      return limited(1);
    });
    const reading = new Firecrawl(settings).scrape("https://a.example");
    const failed = expect(reading).rejects.toThrow(/Firecrawl returned 429: Rate limit exceeded/);
    await vi.advanceTimersByTimeAsync(10_000);
    await failed;
    expect(asked).toBe(3);
  });

  it("does not wait past the fetch's own timeout", async () => {
    let asked = 0;
    stubFetch(() => {
      asked += 1;
      return limited(200);
    });
    await expect(new Firecrawl(settings).scrape("https://a.example")).rejects.toThrow(/429/);
    expect(asked).toBe(1);
  });

  it("stops waiting the moment the run is stopped", async () => {
    stubFetch(() => limited(11));
    const stop = new AbortController();
    const reading = new Firecrawl(settings).scrape("https://a.example", stop.signal);
    const stopped = expect(reading).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1_000);
    stop.abort(new Error("stopped"));
    await stopped;
  });
});

describe("archive", () => {
  it("hashes the exact bytes written, not a normalised form", async () => {
    const text = "  leading and trailing whitespace matters  \r\n";
    const { sourceId, archived } = await new Corpus(join(dir, "corpus")).write("run-9", text);
    expect(archived).toBe(true);
    const expected = createHash("sha256").update(Buffer.from(text, "utf-8")).digest("hex");
    expect(sourceId).toBe(`sha256:${expected}`);
  });
});

/**
 * Amazon product search: the one Apify tool a stage-1 agent has. It is absent
 * without a token, and offered only to a run that covers competitors.
 */
describe("Amazon product search", () => {
  const runner = (items: Array<Record<string, unknown>>) => ({
    async run() {
      return { status: "SUCCEEDED", items };
    },
  });

  it("is withheld entirely when no Apify token is configured", () => {
    // Withheld rather than stubbed: an agent told it has a tool that always
    // throws burns turns rediscovering that.
    const names = research(services(settings, null), Roles.of("champion").tools).map((t) => t.name);
    expect(names).toEqual(["web_search", "web_fetch"]);
  });

  it("is withheld from a run that does not cover competitors, token or not", () => {
    const names = research(services(settings, runner([])), Roles.of("category").tools).map((t) => t.name);
    expect(names).toEqual(["web_search", "web_fetch"]);
  });

  it("is the only Apify tool a competitors run gets", () => {
    const names = research(services(settings, runner([])), Roles.of("competitors").tools).map((t) => t.name);
    expect(names).toEqual(["web_search", "web_fetch", "amazon_find_product"]);
  });

  it("orders found products by reviewsCount so the agent spends on the right one", async () => {
    const list = research(
      services(settings, runner([
        { asin: "B0THIN", title: "four reviews", stars: 5, reviewsCount: 4 },
        { asin: "B0GOOD", title: "sixty one reviews", stars: 3.9, reviewsCount: 61 },
      ])),
      ["amazon_find_product"],
      { runId: "run-x" },
    );
    const result = await list.find((t) => t.name === "amazon_find_product")!.execute("1", { query: "intertrigo cream" });
    expect((result.details as any).products[0].asin).toBe("B0GOOD");
    expect((result.content[0] as any).text).toContain("reviews=61");
  });
});

describe("the fetch gate", () => {
  const markdown = (body: string, title = "A page") =>
    json({ success: true, data: { markdown: body, metadata: { title } } });
  const gate = (admit: boolean, reason: string) => ({
    admit: vi.fn(async () => ({ admit, reason, model: "test-gate", ms: 5 })),
  });
  const gated = (g: ReturnType<typeof gate>, onFetch?: (r: any) => void) =>
    new WebFetchTool(
      settings,
      new Firecrawl(settings),
      new Corpus(settings.corpusPath),
      "run-gate",
      onFetch,
      g,
      "Mullein leaf capsules",
      "UK",
    ).tool();

  it("is absent when no gate model is configured, so tools behave as before", async () => {
    expect(settings.gateModel).toBe("");
    stubFetch(() => markdown("text"));
    const result = await tools("run-g").fetch.execute("1", { url: "https://a.example" });
    expect(result.details.source_id).toMatch(/^sha256:/);
  });

  it("hands the gate the page and the brief, and archives on admit", async () => {
    const g = gate(true, "product page");
    stubFetch(() => markdown("the readable text"));
    const result = await gated(g).execute("1", { url: "https://a.example" });
    expect(g.admit).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Mullein leaf capsules", market: "UK" }),
    );
    expect(result.details.filtered).toBeUndefined();
    expect(result.details.source_id).toMatch(/^sha256:/);
  });

  it("blocks without archiving, and tells the agent to move on", async () => {
    const g = gate(false, "captcha wall");
    stubFetch(() => markdown("verifying your connection"));
    const onFetch = vi.fn();
    const result = await gated(g, onFetch).execute("1", { url: "https://a.example" });
    const text = (result.content[0] as any).text as string;
    expect(text).toMatch(/^FILTERED/);
    expect(text).toContain("captcha wall");
    expect(text).toContain("Do not record it");
    expect(result.details.filtered).toBe(true);
    expect(result.details.source_id).toBe("");
    expect(onFetch).toHaveBeenCalledWith(
      expect.objectContaining({ filtered: true, gate_reason: expect.stringContaining("captcha") }),
    );
    const sourcesDir = join(settings.corpusPath, "runs", "run-gate", "sources");
    expect(existsSync(sourcesDir) ? readdirSync(sourcesDir) : []).toEqual([]);
  });
});

describe("the ledger tools", () => {
  const MAGNACALM = { product: "MagnaCalm 400mg", url: "", market: "", notes: "" };
  const ledgerTools = (
    agent: StageOneAgent = "product",
    options: { nodes?: readonly Node[]; brief?: typeof MAGNACALM; ledger?: MemoryLedger; roster?: AgentRoster; pollMs?: number } = {},
  ) => {
    const nodes = options.nodes ?? STAGE_NODES[1];
    const brief = options.brief ?? MAGNACALM;
    const ledger = options.ledger ?? new MemoryLedger();
    const node = StageOnePlans.nodeOf(agent, nodes);
    const findings = new RunFindings(ledger, "run-l", agent, [node]);
    const check = DoneChecks.of(agent, findings, brief, nodes);
    const checked: Array<{ valid: boolean; problems: readonly string[] }> = [];
    const list = new LedgerToolset({
      findings,
      records: RoleRecords.of(Roles.of(agent)),
      check,
      onChecked: (v, problems) => checked.push({ valid: v, problems }),
      ...(options.roster ? { roster: options.roster } : {}),
      ...(options.pollMs !== undefined ? { pollMs: options.pollMs } : {}),
    }).build();
    const tool = (name: string) => list.find((t) => t.name === name)!;
    return { ledger, tool, names: list.map((t) => t.name), checked };
  };
  const text = (result: any) => result.content[0].text as string;

  it("gives each agent only its own record kinds, and wait_for only with a roster", () => {
    const bare = research(services(settings), Roles.of("product").tools).map((t) => t.name);
    expect(bare).not.toContain("finish");
    const product = ledgerTools("product").names;
    expect(product).toEqual(expect.arrayContaining(["record_attribute", "record_node_status", "read_ledger", "finish"]));
    expect(product).not.toContain("record_competitor");
    expect(product).not.toContain("record_reference");
    expect(product).not.toContain("wait_for");
    expect(ledgerTools("competitors").names).toContain("record_competitor");
    const champion = ledgerTools("champion").names;
    expect(champion).toContain("record_reference");
    expect(champion).not.toContain("record_node_status");
    expect(ledgerTools("category", { roster: new AgentRoster() }).names).toContain("wait_for");
  });

  it("names the one problem with a record, and records nothing", async () => {
    // The two live shapes that each killed a run: an invented enum value and a
    // number where the contract wants a string.
    const { ledger, tool } = ledgerTools();
    const source = { ...minimalPacket().sources[0], kind: "marketplace" };
    expect(text(await tool("record_source").execute("1", { item: source }))).toMatch(/^NOT RECORDED — kind: .*received 'marketplace'/);
    const attribute = { ...minimalPacket().attributes[0], value: 400 };
    expect(text(await tool("record_attribute").execute("2", { item: attribute }))).toMatch(/^NOT RECORDED — value: Expected string, received number/);
    expect(ledger.rows).toHaveLength(0);
  });

  it("refuses a row filed under another agent's node", async () => {
    const { ledger, tool } = ledgerTools("product");
    const attribute = { node: "category_data", key: "seasonality", value: "winter", source_id: "sha256:aaa" };
    expect(text(await tool("record_attribute").execute("1", { item: attribute }))).toMatch(/^NOT RECORDED — this belongs to category_data/);
    expect(ledger.rows).toHaveLength(0);
  });

  it("takes the item as one JSON string as well as an object", async () => {
    // A live glm run stringified the packet on every one of six calls.
    const { tool } = ledgerTools();
    const result = await tool("record_source").execute("1", { item: JSON.stringify(minimalPacket().sources[0]) });
    expect(text(result)).toBe("RECORDED src1");
    expect(text(await tool("record_gap").execute("2", { item: '{"node": "product_data"' }))).toMatch(/^NOT RECORDED — the item did not decode/);
  });

  it("assigns an attribute's id itself, and files the row under the agent that wrote it", async () => {
    const { ledger, tool } = ledgerTools();
    const attribute = { id: "sha256:bbb", source_id: "sha256:aaa", key: "price", value: "£9.99", node: "product_data" };
    expect(text(await tool("record_attribute").execute("1", { item: attribute }))).toBe("RECORDED at1");
    expect(ledger.rows[0]!.payload).not.toHaveProperty("id");
    expect(ledger.rows[0]!.entity).toBe("product");
    expect(ledger.rows[0]!.agent_id).toBe("product");
  });

  it("keeps a product or category fact outside the required fields", async () => {
    // workings_stage1.md 13 and 15: each agent tries for its required fields and may keep more.
    const product = ledgerTools("product");
    const extra = { node: "product_data", key: "third_party_lab_tested", value: "yes", source_id: "sha256:aaa" };
    expect(text(await product.tool("record_attribute").execute("1", { item: extra }))).toMatch(/^RECORDED at1/);
    const category = ledgerTools("category");
    const mood = { node: "category_data", key: "consumer_mood", value: "worried", source_id: "sha256:aaa" };
    expect(text(await category.tool("record_attribute").execute("0", { item: mood }))).toMatch(/^RECORDED at/);
    const monthly = { node: "category_data", metric: "search_volume_monthly", value: 1, unit: "searches", period: "2025", source_id: "sha256:aaa" };
    expect(text(await category.tool("record_measurement").execute("2", { item: monthly }))).toMatch(/^RECORDED me/);
    const segmented = { ...monthly, metric: "category_size: respiratory supplements", unit: "USD billion" };
    expect(text(await category.tool("record_measurement").execute("3", { item: segmented }))).toMatch(/^RECORDED me/);
    expect(product.names).not.toContain("record_excerpt");
    expect(category.names).not.toContain("record_excerpt");
  });

  it("replaces a field recorded again, rather than keeping both", async () => {
    const { ledger, tool } = ledgerTools();
    const price = { node: "product_data", key: "price", value: "£9.99", source_id: "sha256:aaa" };
    await tool("record_attribute").execute("1", { item: price });
    expect(text(await tool("record_attribute").execute("2", { item: { ...price, value: "£8.99" } }))).toBe("RECORDED at2 (replaces at1)");
    expect(ledger.rows.filter((row) => row.retracted_at === "")).toHaveLength(1);
  });

  it("names every category field still open, and wants three years for a trend", async () => {
    const { tool } = ledgerTools("category", { nodes: ["category_data"] });
    const row = { node: "category_data", metric: "search_volume", value: 100, unit: "searches", source_id: "sha256:aaa" };
    for (const period of ["2023", "2024"]) await tool("record_measurement").execute(period, { item: { ...row, period } });
    const answer = text(await tool("finish").execute("f", {}));
    expect(answer).toMatch(/`search_volume` needs rows for at least 3 different years/);
    expect(answer).toMatch(/`category_size` is neither recorded nor gapped/);
    expect(answer).toMatch(/`seasonality` is neither recorded nor gapped/);
  });

  it("files a competitor under its own id", async () => {
    const { ledger, tool } = ledgerTools("competitors");
    const competitor = {
      id: "c3", name: "HERBIFY Mullein", url: "https://herbify.example", relation: "direct", form: "liquid",
      active_ingredients: [{ name_as_printed: "Mullein", name_normalised: "mullein" }],
      shared_actives: ["mullein"], form_as_printed: "as printed", icp_as_printed: "for coughs and chest congestion", source_id: "sha256:ccc",
    };
    expect(text(await tool("record_competitor").execute("1", { item: competitor }))).toBe("RECORDED co1");
    expect(ledger.rows[0]!.entity).toBe("c3");
    expect(ledger.rows[0]!.source_id).toBe("sha256:ccc");
  });

  it("refuses a shared active that is not a pick from the champion's list, on the turn it is recorded", async () => {
    const ledger = new MemoryLedger();
    const champion = ledgerTools("champion", { ledger });
    const competitors = ledgerTools("competitors", { ledger });
    const listed = "mullein leaf extract (wildcrafted mullein leaf)";
    await champion.tool("record_reference").execute("0", {
      item: { name: "Mullevia Mullein Drops", form: "liquid", actives: [listed, "ginger"], icp: "adults with a cough", source_id: "sha256:aaa" },
    });
    const row = {
      id: "c1", name: "HERBIFY Mullein Drops", url: "https://herbify.example", relation: "direct", form: "liquid",
      active_ingredients: [{ name_as_printed: "Mullein Leaf Extract", name_normalised: "mullein leaf extract" }],
      shared_actives: ["mullein leaf extract"], form_as_printed: "as printed", icp_as_printed: "for coughs and chest congestion", source_id: "sha256:ccc",
    };
    expect(text(await competitors.tool("record_competitor").execute("1", { item: row }))).toMatch(
      /^NOT RECORDED — competitor 'HERBIFY Mullein Drops' lists 'mullein leaf extract' as shared, but shared_actives must be copied word for word from the champion's actives: mullein leaf extract \(wildcrafted mullein leaf\), ginger/,
    );
    expect(text(await competitors.tool("record_competitor").execute("2", { item: { ...row, shared_actives: [listed] } }))).toMatch(/^RECORDED co/);
  });

  it("retracts a live row once, and says so when there is none", async () => {
    const { tool } = ledgerTools();
    await tool("record_gap").execute("1", { item: minimalPacket().gaps[0] });
    expect(text(await tool("retract").execute("2", { id: "gap1", why: "found it" }))).toBe("RETRACTED gap1");
    expect(text(await tool("retract").execute("3", { id: "gap1", why: "again" }))).toMatch(/^NOT RETRACTED/);
  });

  it("lets an agent replace and retract only its own rows", async () => {
    // workings_stage1.md: an agent may overwrite its own data, and only read another's.
    const ledger = new MemoryLedger();
    const product = ledgerTools("product", { ledger });
    const category = ledgerTools("category", { ledger });
    const source = minimalPacket().sources[0];
    await product.tool("record_source").execute("1", { item: source });
    expect(text(await category.tool("record_source").execute("2", { item: { ...source, node: "category_data" } }))).toBe("RECORDED src2");
    expect(ledger.rows.filter((row) => row.retracted_at === "")).toHaveLength(2);
    expect(text(await product.tool("record_source").execute("3", { item: source }))).toBe("RECORDED src3 (replaces src1)");
    expect(text(await category.tool("retract").execute("4", { id: "src3", why: "not mine" }))).toMatch(
      /^NOT RETRACTED — src3 was recorded by agent product; an agent retracts only its own rows/,
    );
  });

  it("reads every agent's rows, or one agent's, or one kind's", async () => {
    const ledger = new MemoryLedger();
    const product = ledgerTools("product", { ledger });
    const category = ledgerTools("category", { ledger });
    await product.tool("record_source").execute("1", { item: minimalPacket().sources[0] });
    await category.tool("record_gap").execute("2", { item: { ...minimalPacket().gaps[0], node: "category_data" } });
    const all = text(await category.tool("read_ledger").execute("3", {}));
    expect(all).toContain("src1 [product] source:");
    expect(all).toContain("gap2 [category] gap:");
    expect(text(await category.tool("read_ledger").execute("4", { agent: "product" }))).not.toContain("gap2");
    expect(text(await category.tool("read_ledger").execute("5", { kind: "attribute" }))).toBe("No live rows match.");
  });

  it("waits for another agent's row, polling the ledger, and hands it over", async () => {
    const ledger = new MemoryLedger();
    const roster = new AgentRoster();
    const waiter = ledgerTools("competitors", { ledger, roster, pollMs: 5 });
    const product = ledgerTools("product", { ledger });
    const waiting = waiter.tool("wait_for").execute("1", { agent: "product", kind: "attribute" });
    await new Promise((resolve) => setTimeout(resolve, 12));
    await product.tool("record_attribute").execute("2", { item: minimalPacket().attributes[0] });
    const result = await waiting;
    expect(text(result)).toMatch(/^READY — product has recorded attribute:\nat1 \[product\] attribute:/);
    expect((result.details as any).polls).toBeGreaterThan(1);
  });

  it("stops waiting when the other agent has ended without the row", async () => {
    const roster = new AgentRoster();
    roster.end("product");
    const { tool } = ledgerTools("competitors", { roster, pollMs: 5 });
    const result = await tool("wait_for").execute("1", { agent: "product", kind: "attribute" });
    expect(text(result)).toMatch(/^NOT AVAILABLE — product has ended without recording attribute/);
  });

  it("gives up waiting after its checks, so two agents waiting on each other both go on", async () => {
    const { tool } = ledgerTools("competitors", { roster: new AgentRoster(), pollMs: 0 });
    const result = await tool("wait_for").execute("1", { agent: "category", kind: "measurement" });
    expect(text(result)).toMatch(/^NOT AVAILABLE — category recorded no measurement in 40 checks/);
  });

  it("finishes an agent whose own rows pass its node, and ends its loop", async () => {
    const { tool, checked } = ledgerTools("product", { nodes: ["product_data"] });
    const packet = productPacket();
    for (const [name, items] of [
      ["record_source", packet.sources],
      ["record_attribute", packet.attributes],
      ["record_node_status", packet.nodes],
      ["record_gap", packet.gaps],
    ] as const) {
      for (const item of items) expect(text(await tool(name).execute("r", { item }))).toMatch(/^RECORDED/);
    }
    const result = await tool("finish").execute("f", {});
    expect(text(result)).toMatch(/^FINISHED/);
    expect(result.terminate).toBe(true);
    expect(checked).toEqual([{ valid: true, problems: [] }]);
  });

  it("checks an agent's own rows only, not the rows other agents have not finished", async () => {
    const ledger = new MemoryLedger();
    const product = ledgerTools("product", { ledger });
    const category = ledgerTools("category", { ledger });
    await category.tool("record_attribute").execute("0", { item: { node: "category_data", key: "seasonality", value: "winter", source_id: "sha256:nowhere" } });
    const packet = productPacket();
    for (const [name, items] of [
      ["record_source", packet.sources],
      ["record_attribute", packet.attributes],
      ["record_node_status", packet.nodes],
      ["record_gap", packet.gaps],
    ] as const) {
      for (const item of items) await product.tool(name).execute("r", { item });
    }
    expect(text(await product.tool("finish").execute("f", {}))).toMatch(/^FINISHED/);
  });

  it("hands back every cross-field problem, numbered, and keeps the agent going", async () => {
    const { tool, checked } = ledgerTools("product", { nodes: ["product_data"] });
    const orphan = { node: "product_data", key: "dose_per_serving", value: "400 mg", source_id: "sha256:nowhere" };
    await tool("record_attribute").execute("1", { item: orphan });
    const result = await tool("finish").execute("f", {});
    expect(text(result)).toMatch(/^NOT FINISHED — 12 problems/);
    expect(text(result)).toContain("1. `name` is neither recorded nor gapped");
    expect(text(result)).toContain("attribute 'at1' cites source 'sha256:nowhere', which is not in the packet");
    expect(text(result)).toContain("12. gap list is empty; real research always has holes");
    expect(result.terminate).toBeUndefined();
    expect(checked[0]!.problems).toHaveLength(12);
  });

  it("finishes the champion once its reference is recorded with its ranking", async () => {
    const { tool } = ledgerTools("champion");
    expect(text(await tool("finish").execute("0", {}))).toContain("1. no champion is recorded");
    const source = { ...minimalPacket().sources[0], node: "competitors" };
    await tool("record_source").execute("1", { item: source });
    const reference = { name: "MagnaCalm Glycinate", form: "capsule", actives: ["magnesium glycinate"], icp: "adults who sleep badly", source_id: "sha256:aaa" };
    await tool("record_reference").execute("2", { item: reference });
    expect(text(await tool("finish").execute("3", {}))).toMatch(/carries no popularity evidence/);
    await tool("record_reference").execute("4", {
      item: { ...reference, reviews_count: 900, runner_up_name: "CalmWell", runner_up_reviews: 400, amazon_url: "https://www.amazon.com/dp/B0X" },
    });
    expect(text(await tool("finish").execute("5", {}))).toMatch(/^FINISHED/);
  });

  it("needs no ranking from the champion of a url brief", async () => {
    const { tool } = ledgerTools("champion", { brief: { ...MAGNACALM, product: "", url: "https://magnacalm.example" } });
    await tool("record_source").execute("1", { item: { ...minimalPacket().sources[0], node: "competitors" } });
    await tool("record_reference").execute("2", {
      item: { name: "MagnaCalm", form: "capsule", actives: ["magnesium glycinate"], icp: "adults with a cough", source_id: "sha256:aaa" },
    });
    expect(text(await tool("finish").execute("3", {}))).toMatch(/^FINISHED/);
  });

  it("refuses a sixth check without spending anything, and ends the loop", async () => {
    const { tool, checked } = ledgerTools("product", { nodes: ["product_data"] });
    for (let i = 1; i <= 5; i++) {
      expect(text(await tool("finish").execute(String(i), {}))).toContain(`Checks used: ${i} of 5.`);
    }
    for (const call of ["6", "7"]) {
      const refused = await tool("finish").execute(call, {});
      expect(text(refused)).toMatch(/^NOT CHECKED — your 5 checks are spent/);
      expect(refused.terminate).toBe(true);
    }
    expect(checked).toHaveLength(5);
  });

  it("runs finish after the records it arrived with", () => {
    // pi runs a tool batch in parallel unless one of its tools is sequential.
    expect(ledgerTools().tool("finish").executionMode).toBe("sequential");
  });
});

describe("the service queues", () => {
  it("lets three fetches issued at once reach Firecrawl at most two at a time", async () => {
    // Firecrawl's plan allows 2 concurrent scrapes (GET /v2/concurrency-check,
    // 2026-09-29); one agent alone sent 3 within 2 ms.
    let inFlight = 0;
    let peak = 0;
    stubFetch(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return json({ success: true, data: { markdown: "a page", metadata: { title: "t" } } });
    });
    const shared = ServiceClients.forSettings({ ...settings, firecrawlConcurrency: 2 });
    const fetches = [1, 2, 3].map((n) =>
      research(shared, ["web_fetch"], { runId: `run-q${n}` }).find((t) => t.name === "web_fetch")!,
    );
    const results = await Promise.all(fetches.map((f, n) => f.execute(String(n), { url: `https://a.example/${n}` })));
    expect(results).toHaveLength(3);
    expect(peak).toBe(2);
  });

  it("drops a waiting call whose run was stopped, without taking a slot", async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      await held;
      return json({ success: true, data: { markdown: "a page" } });
    });
    const shared = ServiceClients.forSettings({ ...settings, firecrawlConcurrency: 1 });
    const first = shared.pages.scrape("https://a.example/1");
    const stop = new AbortController();
    const waiting = shared.pages.scrape("https://a.example/2", stop.signal);
    stop.abort(new Error("stopped"));
    await expect(waiting).rejects.toThrow("stopped");
    release();
    await first;
    expect(calls).toBe(1);
  });
});
