/**
 * The agent's two tools.
 *
 * `fetch` is stubbed, so these test our handling of the two services rather than
 * the services themselves. The one thing that must be exactly right is the
 * source id: `GET /runs/:id/sources/:sha` re-hashes the archived file and
 * reports whether it still matches, so an id computed over anything other than
 * the bytes written turns that audit into a permanent false negative.
 */

import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AMAZON_REVIEWS_ACTOR, TRUSTPILOT_ACTOR, capFor } from "../src/apify.js";
import { loadSettings, type Settings } from "../src/settings.js";
import { archive, createResearchTools, reviewLimit } from "../src/tools.js";

let dir: string;
let settings: Settings;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-tools-"));
  settings = {
    ...loadSettings(),
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
  const list = createResearchTools({ settings, runId });
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
    const { sourceId, archived } = await archive(join(dir, "corpus"), "run-9", text);
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
    createResearchTools({ settings, runId, actorRunner });

  it("are withheld entirely when no Apify token is configured", () => {
    // Withheld rather than stubbed: an agent told it has a tool that always
    // throws burns turns rediscovering that, and the prompt knows how to gap.
    const names = createResearchTools({
      settings: { ...settings, apifyToken: "" },
      runId: "run-x",
      actorRunner: null,
    }).map((t) => t.name);

    expect(names).toEqual(["web_search", "web_fetch"]);
  });

  it("are withheld from a run that does not cover review mining, token or not", () => {
    // The only tools that cost money per call; a product-data run has no use for them.
    const names = createResearchTools({
      settings,
      runId: "run-x",
      actorRunner: runner([]),
      reviewTools: false,
    }).map((t) => t.name);
    expect(names).toEqual(["web_search", "web_fetch"]);
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
    expect((result.content[0] as any).text).toContain("[3*]");
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
    createResearchTools({ settings: { ...settings, apifyMaxReviews: 10 }, runId: "run-cap", actorRunner })
      .find((t) => t.name === name)!;

  it("cuts an Amazon request to the setting, and sizes the spend cap from the cut number", async () => {
    const { calls, actorRunner } = recording();
    const result = await tool(actorRunner, "amazon_reviews").execute("1", {
      product_url: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
      max_reviews: 500,
    });

    expect(calls[0]!.input.maxReviews).toBe(10);
    expect(calls[0]!.cap).toBe(capFor(AMAZON_REVIEWS_ACTOR, 10));
    expect(calls[0]!.cap).toBeLessThan(capFor(AMAZON_REVIEWS_ACTOR, 500));
    // Told, so a capped pull is not mistaken for a product with few reviews.
    expect((result.content[0] as any).text).toMatch(/asked for 500 reviews; this server caps each call at 10/);
  });

  it("cuts a Trustpilot request the same way", async () => {
    const { calls, actorRunner } = recording();
    await tool(actorRunner, "trustpilot_reviews").execute("1", { domain: "huel.com", max_reviews: 500 });

    expect(calls[0]!.input.maxItems).toBe(10);
    expect(calls[0]!.cap).toBe(capFor(TRUSTPILOT_ACTOR, 10));
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
    expect(reviewLimit(undefined, 10)).toBe(10);
    expect(reviewLimit(0, 10)).toBe(1);
    expect(reviewLimit(-5, 10)).toBe(1);
    expect(reviewLimit(7.9, 10)).toBe(7);
    expect(reviewLimit(Number.NaN, 10)).toBe(10);
  });
});
