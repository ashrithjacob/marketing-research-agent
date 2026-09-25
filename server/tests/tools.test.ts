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
  ReviewRendering,
  WebFetchTool,
  type ToolsetOptions,
} from "../src/agent/tools/index.js";
import {
  STAGE_NODES,
  locatorSchema,
} from "../src/domain/index.js";
import { minimalPacket, reviewPacket } from "./fixtures.js";

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
  const list = new ResearchToolset({ settings, runId }).build();
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

  it("surfaces a Firecrawl error", async () => {
    stubFetch(() => json({ success: false, error: "rate limited" }, 429));
    await expect(tools().fetch.execute("1", { url: "https://a.example" })).rejects.toThrow(
      /rate limited/,
    );
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
 * The three review tools.
 *
 * The Apify runner is injected, so nothing here touches the network. What these
 * protect is the wiring rather than the mapping (`apify.test.ts` covers that):
 * the tools must be absent without a token, and every excerpt must be archived
 * under a re-hashable id, because §2.3 requires each one to cite a source that
 * can be read back.
 */
describe("review tools", () => {
  const runner = (items: Array<Record<string, unknown>>) => ({
    async run() {
      return { status: "SUCCEEDED", items };
    },
  });

  const reviewTools = (actorRunner: any, runId = "run-r") =>
    new ResearchToolset({ settings, runId, actorRunner }).build();

  it("are withheld entirely when no Apify token is configured", () => {
    // Withheld rather than stubbed: an agent told it has a tool that always
    // throws burns turns rediscovering that, and the prompt knows how to gap.
    const names = new ResearchToolset({
      settings: { ...settings, apifyToken: "" },
      runId: "run-x",
      actorRunner: null,
    }).build().map((t) => t.name);

    expect(names).toEqual(["web_search", "web_fetch"]);
  });

  it("are withheld from a run that does not cover review mining, token or not", () => {
    // The only tools that cost money per call; a product-data run has no use for them.
    const names = new ResearchToolset({
      settings,
      runId: "run-x",
      actorRunner: runner([]),
      reviewTools: false,
    }).build().map((t) => t.name);
    expect(names).toEqual(["web_search", "web_fetch"]);
  });

  it("offers Amazon product search alone to a competitors run", () => {
    // Discovery, not reviews: the review tools stay withheld.
    const names = new ResearchToolset({
      settings,
      runId: "run-x",
      actorRunner: runner([]),
      reviewTools: false,
      productSearch: true,
    }).build().map((t) => t.name);
    expect(names).toEqual(["web_search", "web_fetch", "amazon_find_product"]);
  });

  it("are present once a runner exists", () => {
    const names = reviewTools(runner([])).map((t) => t.name);
    expect(names).toContain("amazon_find_product");
    expect(names).toContain("amazon_reviews");
    expect(names).toContain("trustpilot_reviews");
  });

  it("archives excerpts under an id that re-hashes to the stored bytes", async () => {
    const list = reviewTools(
      runner([
        {
          reviewDescription: "It works but you must reapply several times a day.",
          ratingScore: 3,
          date: "2026-09-06",
          reviewUrl: "https://www.amazon.com/gp/customer-reviews/R1",
          reviewTitle: "ok",
          isVerified: true,
        },
      ]),
    );
    const tool = list.find((t) => t.name === "amazon_reviews")!;
    const result = await tool.execute("1", {
      product_url: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
    });

    const sourceId: string = (result.details as any).source_id;
    expect(sourceId).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect((result.details as any).archived).toBe(true);

    const stored = readFileSync(
      join(settings.corpusPath, "runs", "run-r", "sources", sourceId.slice(7)),
    );
    expect(`sha256:${createHash("sha256").update(stored).digest("hex")}`).toBe(sourceId);
    expect(JSON.parse(stored.toString())[0].text).toBe(
      "It works but you must reapply several times a day.",
    );
    expect((result.content[0] as any).text).toContain("pull: p1");
  });

  it("keeps review text out of what the model reads", async () => {
    // Run 1d2ad3f2 (2026-09-25): shown every review in the pull result, the model
    // spent 720s and 78,225 output tokens copying them into the packet, dropped
    // 135 of 216, and mangled a source hash. The server now writes the excerpts,
    // so the text never needs to reach the model at all.
    const list = reviewTools(
      runner([
        {
          reviewDescription: "Less swelling after three weeks.",
          ratingScore: 4,
          reviewUrl: "https://www.amazon.com/gp/customer-reviews/R83A6B2PFC42",
        },
      ]),
    );
    const pull = await list.find((t) => t.name === "amazon_reviews")!.execute("1", {
      product_url: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 4,
    });
    const text = (pull.content[0] as any).text as string;
    expect(text).not.toContain("Less swelling");
    expect(text).toContain("reviews: 1 new (4* 1)");
    expect(text).toContain("Never copy a review into the packet");
  });

  it("surfaces a gap in the text the model reads, not just in details", async () => {
    // A gap the model cannot see is a gap it will not record.
    const list = reviewTools(
      runner([{ error: "no_relevant_reviews_found", totalCategoryRatings: 61, totalCategoryReviews: 0 }]),
    );
    const tool = list.find((t) => t.name === "amazon_reviews")!;
    const result = await tool.execute("1", {
      product_url: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
    });

    const text = (result.content[0] as any).text;
    expect(text).toContain("GAP:");
    expect(text).toContain("No 3-star reviews with text");
    expect(text).toContain("do not describe the node as complete");
  });

  it("rejects a star band outside 1-5 rather than silently fetching a mixed sample", async () => {
    const list = reviewTools(runner([]));
    const tool = list.find((t) => t.name === "trustpilot_reviews")!;
    await expect(tool.execute("1", { domain: "huel.com", star: 9 })).rejects.toThrow(
      /star must be between 1 and 5/,
    );
  });

  it("orders found products by reviewsCount so the agent spends on the right one", async () => {
    const list = reviewTools(
      runner([
        { asin: "B0THIN", title: "four reviews", stars: 5, reviewsCount: 4 },
        { asin: "B0GOOD", title: "sixty one reviews", stars: 3.9, reviewsCount: 61 },
      ]),
    );
    const tool = list.find((t) => t.name === "amazon_find_product")!;
    const result = await tool.execute("1", { query: "intertrigo cream" });

    expect((result.details as any).products[0].asin).toBe("B0GOOD");
    expect((result.content[0] as any).text).toContain("reviews=61");
  });
});

/**
 * `MRA_APIFY_MAX_REVIEWS` is the ceiling, not just the default.
 *
 * It used to be only the default: `max_reviews` from the model went straight to
 * the actor, and `capFor` sized the spend cap from it — so asking for 500
 * authorised $6 on one Amazon call. The free plan's 10-per-call limit hid that;
 * a paid plan would not have.
 */
describe("review volume is bounded by the server, not the agent", () => {
  const recording = () => {
    const calls: Array<{ actorId: string; input: Record<string, any>; cap: number }> = [];
    const actorRunner = {
      async run(actorId: string, input: Record<string, unknown>, cap: number) {
        calls.push({ actorId, input, cap });
        return { status: "SUCCEEDED", items: [{ text: "fine", rating: 3, reviewDescription: "fine", ratingScore: 3 }] };
      },
    };
    return { calls, actorRunner };
  };

  const tool = (actorRunner: any, name: string) =>
    new ResearchToolset({ settings: { ...settings, apifyMaxReviews: 10 }, runId: "run-cap", actorRunner }).build()
      .find((t) => t.name === name)!;

  it("cuts an Amazon request to the setting, and sizes the spend cap from the cut number", async () => {
    const { calls, actorRunner } = recording();
    const result = await tool(actorRunner, "amazon_reviews").execute("1", {
      product_url: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
      max_reviews: 500,
    });

    expect(calls[0]!.input.maxReviews).toBe(10);
    expect(calls[0]!.cap).toBe(Spend.capFor(AMAZON_REVIEWS_ACTOR, 10));
    expect(calls[0]!.cap).toBeLessThan(Spend.capFor(AMAZON_REVIEWS_ACTOR, 500));
    // Told, so a capped pull is not mistaken for a product with few reviews.
    expect((result.content[0] as any).text).toMatch(/asked for 500 reviews; this server caps each call at 10/);
  });

  it("cuts a Trustpilot request the same way", async () => {
    const { calls, actorRunner } = recording();
    await tool(actorRunner, "trustpilot_reviews").execute("1", { domain: "huel.com", max_reviews: 500 });

    expect(calls[0]!.input.maxItems).toBe(10);
    expect(calls[0]!.cap).toBe(Spend.capFor(TRUSTPILOT_ACTOR, 10));
  });

  it("leaves a request within the limit alone, with no note", async () => {
    const { calls, actorRunner } = recording();
    const result = await tool(actorRunner, "amazon_reviews").execute("1", {
      product_url: "https://www.amazon.com/dp/B0H2JVQ9GR",
      max_reviews: 4,
    });

    expect(calls[0]!.input.maxReviews).toBe(4);
    expect((result.content[0] as any).text).not.toMatch(/caps each call/);
  });

  it("uses the setting when the agent asks for nothing, and never goes below one", () => {
    expect(ReviewRendering.limit(undefined, 10)).toBe(10);
    expect(ReviewRendering.limit(0, 10)).toBe(1);
    expect(ReviewRendering.limit(-5, 10)).toBe(1);
    expect(ReviewRendering.limit(7.9, 10)).toBe(7);
    expect(ReviewRendering.limit(Number.NaN, 10)).toBe(10);
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

describe("validate_packet", () => {
  const check = (overrides: Partial<ToolsetOptions["packetCheck"] & {}> = {}) => {
    const valid: any[] = [];
    const checked: Array<{ valid: boolean; problems: readonly string[] }> = [];
    const list = new ResearchToolset({
      settings,
      runId: "run-v",
      packetCheck: {
        nodes: STAGE_NODES[1],
        brief: { product: "MagnaCalm 400mg" },
        onValid: (p) => valid.push(p),
        onChecked: (v, problems) => checked.push({ valid: v, problems }),
        ...overrides,
      },
    }).build();
    return { tool: list.find((t) => t.name === "validate_packet")!, valid, checked };
  };
  const text = (result: any) => result.content[0].text as string;

  it("is offered to every run that has a contract to check", () => {
    const names = new ResearchToolset({ settings, runId: "r" }).build().map((t) => t.name);
    expect(names).not.toContain("validate_packet");
    expect(check().tool).toBeDefined();
  });

  it("passes a good draft, and hands it over exactly once", async () => {
    const { tool, valid, checked } = check();
    const result = await tool.execute("1", { packet: minimalPacket() });
    expect(text(result)).toMatch(/^VALID/);
    expect(text(result)).toContain("sources 1");
    expect(valid).toHaveLength(1);
    expect(checked).toEqual([{ valid: true, problems: [] }]);

    // First pass wins: a second valid draft does not replace it.
    await tool.execute("2", { packet: minimalPacket() });
    expect(valid).toHaveLength(1);
  });

  it("names the problems instead of rejecting a run for them", async () => {
    // The two live shapes that each killed a run: an invented enum value and a
    // float star rating.
    const draft = minimalPacket();
    draft.sources[0].kind = "marketplace";
    draft.attributes[0].value = 400; // a number where the contract wants a string
    const { tool, valid, checked } = check();
    const result = await tool.execute("1", { packet: draft });

    expect(text(result)).toMatch(/^NOT VALID — 2 problems/);
    expect(text(result)).toContain("received 'marketplace'");
    expect(text(result)).toContain("Checks used: 1 of 5");
    expect(valid).toHaveLength(0);
    expect(checked[0]!.valid).toBe(false);
  });

  it("refuses a draft that dropped evidence rather than fixing it", async () => {
    const { tool } = check();
    const full = minimalPacket();
    full.sources.push({ ...full.sources[0], id: "sha256:second" });
    await tool.execute("1", { packet: full });

    const thinner = minimalPacket(); // one source again
    const result = await tool.execute("2", { packet: thinner });
    expect(text(result)).toMatch(/^NOT CHECKED/);
    expect(text(result)).toContain("do not drop the evidence");
    // A refusal is not a contract failure, so it costs no budget.
    expect((result.details as any).reason).toBe("evidence_shrank");
  });

  it("stops after five checks", async () => {
    const { tool } = check();
    const bad = minimalPacket();
    bad.gaps = [];
    for (let i = 1; i <= 5; i++) {
      expect(text(await tool.execute(String(i), { packet: bad }))).toMatch(/^NOT VALID/);
    }
    const spent = await tool.execute("6", { packet: bad });
    expect(text(spent)).toMatch(/^NOT CHECKED/);
    expect(text(spent)).toContain("checks for this run are spent");
  });

  it("takes the packet as one JSON string as well as an object", async () => {
    // A live glm run stringified the packet on every one of six calls and got
    // back "Expected object, received string", so the contract problems it was
    // there to learn about were never named and the run settled invalid.
    const { tool, valid, checked } = check();
    const result = await tool.execute("1", { packet: JSON.stringify(minimalPacket()) });
    expect(text(result)).toMatch(/^VALID/);
    expect(valid).toHaveLength(1);
    expect(checked).toEqual([{ valid: true, problems: [] }]);
  });

  it("refuses a string that is not one JSON object, without spending budget", async () => {
    const { tool } = check();
    const truncated = await tool.execute("1", { packet: '{"contract_version": "1"' });
    expect(text(truncated)).toMatch(/^NOT CHECKED/);
    expect(text(truncated)).toContain("one string");
    expect((truncated.details as any).reason).toBe("not_a_packet_object");

    const prose = await tool.execute("2", { packet: "here is the packet you asked for" });
    expect(text(prose)).toMatch(/^NOT CHECKED/);
    expect((prose.details as any).reason).toBe("not_a_packet_object");

    const good = await tool.execute("3", { packet: minimalPacket() });
    expect(text(good)).toMatch(/^VALID/);
  });

  it("checks against the run's own scope and brief", async () => {
    // A review-mining packet is stage 2: not this run's work at all.
    const { tool } = check({ nodes: ["product_data"] as any });
    const answer = text(await tool.execute("1", { packet: reviewPacket() }));
    expect(answer).toContain("which is collected in stage 2");
    expect(answer).toContain("that is a separate run");
  });
});
