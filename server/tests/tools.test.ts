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
  ResearchToolset,
  WebFetchTool,
} from "../src/agent/tools/index.js";
import { LedgerPacket, RunFindings } from "../src/agent/index.js";
import { ServiceClients } from "../src/adapters/index.js";
import {
  STAGE_NODES,
  locatorSchema,
  type Node,
} from "../src/domain/index.js";
import { MemoryLedger, minimalPacket, reviewPacket, services } from "./fixtures.js";

let dir: string;
let settings: Settings;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-tools-"));
  settings = {
    ...Env.settings(),
    corpusPath: join(dir, "corpus"),
    searxngUrl: "http://searxng.test",
    firecrawlApiKey: "test-key",
    firecrawlBaseUrl: "https://firecrawl.test",
    fetchCharLimit: 100,
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

const tools = (runId = "run-1") => {
  const list = new ResearchToolset({ settings, runId, services: services(settings) }).build();
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
  it("reads SearXNG's json results", async () => {
    stubFetch((url) => {
      expect(url).toContain("format=json");
      expect(url).toContain("q=magnesium");
      return json({
        results: [
          { title: "A", url: "https://a.example", content: "snippet a" },
          { title: "B", url: "https://b.example", content: "snippet b" },
        ],
      });
    });
    const result = await tools().search.execute("1", { query: "magnesium" });
    expect(result.details.hits).toHaveLength(2);
    expect((result.content[0] as any).text).toContain("https://a.example");
  });

  it("honours max_results and clamps it", async () => {
    stubFetch(() =>
      json({ results: Array.from({ length: 40 }, (_, i) => ({ title: `${i}`, url: `https://${i}.example`, content: "" })) }),
    );
    expect((await tools().search.execute("1", { query: "x", max_results: 3 })).details.hits).toHaveLength(3);
    expect((await tools().search.execute("1", { query: "x", max_results: 99 })).details.hits).toHaveLength(25);
  });

  it("says so plainly when there are no results", async () => {
    stubFetch(() => json({ results: [] }));
    const result = await tools().search.execute("1", { query: "nothing" });
    expect((result.content[0] as any).text).toMatch(/No results/);
  });

  it("reports which engines answered and which failed, without changing what the model reads", async () => {
    stubFetch(() =>
      json({
        results: [
          { title: "A", url: "https://a.example", content: "a", engines: ["google cse"] },
          { title: "B", url: "https://b.example", content: "b", engines: ["google cse", "bing"] },
        ],
        unresponsive_engines: [["brave", "too many requests"], ["duckduckgo", "CAPTCHA"]],
      }),
    );
    const result = await tools().search.execute("1", { query: "magnesium" });
    expect(result.details.service).toEqual({
      service: "SearXNG",
      outcome: "degraded",
      parts: [
        { name: "google cse", ok: true, detail: "2 results" },
        { name: "bing", ok: true, detail: "1 result" },
        { name: "brave", ok: false, detail: "too many requests" },
        { name: "duckduckgo", ok: false, detail: "CAPTCHA" },
      ],
    });
    expect((result.content[0] as any).text).not.toMatch(/brave|engine/i);
  });

  it("calls a search failed, not empty, when no engine answered", async () => {
    stubFetch(() => json({ results: [], unresponsive_engines: [["brave", "too many requests"]] }));
    const result = await tools().search.execute("1", { query: "x" });
    expect(result.details.service.outcome).toBe("failed");
  });

  it("throws on a SearXNG error rather than returning an empty page", async () => {
    // A stock SearXNG refuses format=json with a 403, and swallowing that makes
    // it look like the web simply has nothing to say about the product.
    stubFetch(() => new Response("forbidden", { status: 403 }));
    await expect(tools().search.execute("1", { query: "x" })).rejects.toThrow(/403/);
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
    await expect(reading).resolves.toEqual({ text: "# page", title: "T" });
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
    const names = new ResearchToolset({ settings, runId: "run-x", services: services(settings, null), productSearch: true })
      .build()
      .map((t) => t.name);
    expect(names).toEqual(["web_search", "web_fetch"]);
  });

  it("is withheld from a run that does not cover competitors, token or not", () => {
    const names = new ResearchToolset({ settings, runId: "run-x", services: services(settings, runner([])) })
      .build()
      .map((t) => t.name);
    expect(names).toEqual(["web_search", "web_fetch"]);
  });

  it("is the only Apify tool a competitors run gets", () => {
    const names = new ResearchToolset({ settings, runId: "run-x", services: services(settings, runner([])), productSearch: true })
      .build()
      .map((t) => t.name);
    expect(names).toEqual(["web_search", "web_fetch", "amazon_find_product"]);
  });

  it("orders found products by reviewsCount so the agent spends on the right one", async () => {
    const list = new ResearchToolset({
      settings,
      runId: "run-x",
      productSearch: true,
      services: services(settings, runner([
        { asin: "B0THIN", title: "four reviews", stars: 5, reviewsCount: 4 },
        { asin: "B0GOOD", title: "sixty one reviews", stars: 3.9, reviewsCount: 61 },
      ])),
    }).build();
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
  const ledgerTools = (nodes: readonly Node[] = STAGE_NODES[1], brief = { product: "MagnaCalm 400mg", url: "", market: "", notes: "" }) => {
    const ledger = new MemoryLedger();
    const findings = new RunFindings(ledger, "run-l", "parent", nodes);
    const packet = new LedgerPacket(findings, { brief, nodes });
    const valid: any[] = [];
    const checked: Array<{ valid: boolean; problems: readonly string[] }> = [];
    const list = new ResearchToolset({
      settings,
      runId: "run-l",
      services: services(settings),
      findings: {
        nodes,
        findings,
        packet,
        hooks: { onValid: (p) => valid.push(p), onChecked: (v, problems) => checked.push({ valid: v, problems }) },
      },
    }).build();
    const tool = (name: string) => list.find((t) => t.name === name)!;
    return { ledger, tool, names: list.map((t) => t.name), valid, checked };
  };
  const text = (result: any) => result.content[0].text as string;

  it("are offered only to a run that has a ledger, and competitor records only with competitors in scope", () => {
    const bare = new ResearchToolset({ settings, runId: "r", services: services(settings) }).build().map((t) => t.name);
    expect(bare).not.toContain("finish");
    expect(ledgerTools().names).toContain("record_competitor");
    const productOnly = ledgerTools(["product_data"]).names;
    expect(productOnly).toContain("finish");
    expect(productOnly).not.toContain("record_competitor");
    expect(productOnly).not.toContain("record_reference");
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

  it("takes the item as one JSON string as well as an object", async () => {
    // A live glm run stringified the packet on every one of six calls.
    const { tool } = ledgerTools();
    const result = await tool("record_source").execute("1", { item: JSON.stringify(minimalPacket().sources[0]) });
    expect(text(result)).toBe("RECORDED src1");
    expect(text(await tool("record_gap").execute("2", { item: '{"node": "product_data"' }))).toMatch(/^NOT RECORDED — the item did not decode/);
  });

  it("assigns an excerpt's id itself, whatever the model sent", async () => {
    const { ledger, tool } = ledgerTools();
    const excerpt = { id: "sha256:bbb", source_id: "sha256:aaa", text: "Wake up rested.", node: "product_data" };
    expect(text(await tool("record_excerpt").execute("1", { item: excerpt }))).toBe("RECORDED ex1");
    expect(ledger.rows[0]!.payload).not.toHaveProperty("id");
    expect(ledger.rows[0]!.entity).toBe("product");
  });

  it("files a competitor under its own id", async () => {
    const { ledger, tool } = ledgerTools();
    const competitor = {
      id: "c3", name: "HERBIFY Mullein", url: "https://herbify.example", relation: "direct", form: "liquid",
      active_ingredients: [{ name_as_printed: "Mullein", name_normalised: "mullein" }],
      shared_actives: ["mullein"], source_id: "sha256:ccc",
    };
    expect(text(await tool("record_competitor").execute("1", { item: competitor }))).toBe("RECORDED co1");
    expect(ledger.rows[0]!.entity).toBe("c3");
    expect(ledger.rows[0]!.source_id).toBe("sha256:ccc");
  });

  it("retracts a live row once, and says so when there is none", async () => {
    const { tool } = ledgerTools();
    await tool("record_gap").execute("1", { item: minimalPacket().gaps[0] });
    expect(text(await tool("retract").execute("2", { id: "gap1", why: "found it" }))).toBe("RETRACTED gap1");
    expect(text(await tool("retract").execute("3", { id: "gap1", why: "again" }))).toMatch(/^NOT RETRACTED/);
  });

  it("finishes a complete ledger, ends the loop, and hands the packet over", async () => {
    const { tool, valid, checked } = ledgerTools(["product_data"]);
    const packet = minimalPacket();
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
    expect(valid).toHaveLength(1);
    expect(valid[0].brief.product).toBe("MagnaCalm 400mg");
    expect(valid[0].attributes[0].id).toBe("at2");
    expect(checked).toEqual([{ valid: true, problems: [] }]);
  });

  it("hands back every cross-field problem, numbered, and keeps the run going", async () => {
    const { tool, valid, checked } = ledgerTools(["product_data"]);
    const orphan = { node: "product_data", key: "dose_per_serving", value: "400 mg", source_id: "sha256:nowhere" };
    await tool("record_attribute").execute("1", { item: orphan });
    const result = await tool("finish").execute("f", {});
    expect(text(result)).toMatch(/^NOT FINISHED — 3 problems/);
    expect(text(result)).toContain("2. attribute 'at1' cites source 'sha256:nowhere', which is not in the packet");
    expect(text(result)).toContain("3. gap list is empty; real research always has holes");
    expect(result.terminate).toBeUndefined();
    expect(valid).toHaveLength(0);
    expect(checked[0]!.problems).toHaveLength(3);
  });

  it("refuses a sixth check without spending anything, and ends the loop", async () => {
    const { tool, checked } = ledgerTools(["product_data"]);
    for (let i = 1; i <= 5; i++) {
      expect(text(await tool("finish").execute(String(i), {}))).toContain(`Checks used: ${i} of 5.`);
    }
    for (const call of ["6", "7"]) {
      const refused = await tool("finish").execute(call, {});
      expect(text(refused)).toMatch(/^NOT CHECKED — the 5 checks for this run are spent/);
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
      new ResearchToolset({ settings, runId: `run-q${n}`, services: shared }).build().find((t) => t.name === "web_fetch")!,
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
