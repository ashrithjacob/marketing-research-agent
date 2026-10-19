/** Stage 3: reviews from a store's Judge.me widget and from Amazon through Woot, up to the per-product limit, stored once per product; the response shapes are the ones measured on 2026-10-17. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { JudgemeReviews, PublicUrls, ShopifyStorefront, WootReviews } from "../src/adapters/index.js";
import { AmazonListingFinder, Pipeline, ReviewListings, ReviewStage } from "../src/agent/index.js";
import { Asins, type CollectedReview, type ReviewListing, type ReviewSource, type ReviewSourceName, type Storefront, type StorefrontFacts } from "../src/domain/index.js";
import { App } from "../src/http/index.js";

import { Faux, FakeWeb, NoBilling, FakeVisuals, TestSettings } from "./fakes.js";
import { DROPS_URL, GUMMIES_URL, PAGES, PRODUCT_URL, RESOLUTION, SEARCH_HITS } from "./mullevia.js";
import { PostgresStores } from "./postgres-stores.js";
import { RunDriver } from "./run-driver.js";
import { ScriptedAgents } from "./scripted-agents.js";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const { settings } = TestSettings.make();

afterEach(() => vi.unstubAllGlobals());

describe("Judge.me", () => {
  it("pages the store's widget endpoint 30 at a time and keeps the text as written, without markup", async () => {
    const row = (n: number) => ({ uuid: `u${n}`, title: "", rating: 3, body_html: "<p>Clears the mucus &amp; tastes fine</p>", verified_buyer: true, created_at: "2026-10-12T14:05:31.391Z", thumb_up: 2 });
    const fetch = vi.fn(async (url: string) => json({ reviews: new URL(url).searchParams.get("page") === "1" ? [row(1), row(2)] : [row(3)], pagination: { total_pages: 2 } }));
    vi.stubGlobal("fetch", fetch);
    const reviews = await new JudgemeReviews(settings).collect({ source: "judgeme", shop_domain: "shop.myshopify.com", product_id: "157" }, 500);
    expect(reviews.map((r) => r.source_review_id)).toEqual(["u1", "u2", "u3"]);
    expect(reviews[0]).toMatchObject({ body: "Clears the mucus & tastes fine", verified: true, review_date: "2026-10-12", helpful_votes: 2 });
    const first = new URL(fetch.mock.calls[0]![0] as string);
    expect(Object.fromEntries(first.searchParams)).toMatchObject({ shop_domain: "shop.myshopify.com", product_id: "157", per_page: "30", page: "1" });
  });
});

describe("Woot", () => {
  it("walks the star bands 3, 1, 2, 4, 5 up to the band size, follows the cursor, and drops a review outside its band", async () => {
    const pages: Record<string, unknown> = {
      "3": { Reviews: [{ Author: "A", Text: "Doesn&#39;t do much", OverallRating: 3, IsVerifiedPurchase: true, HelpfulVotes: 10, OriginDescription: "Reviewed in the United States on June 17, 2026" }, { Author: "B", Text: "five", OverallRating: 5 }], PagingNext: "c2" },
      "3:c2": { Reviews: [{ Author: "C", Text: "meh", OverallRating: 3 }], PagingNext: null },
      "1": { Reviews: [{ Author: "D", Text: "awful", OverallRating: 1 }], PagingNext: null },
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const q = new URL(url).searchParams;
      return json(pages[q.get("pagingNext") ? `${q.get("filter")}:${q.get("pagingNext")}` : q.get("filter")!] ?? { Reviews: [], PagingNext: null });
    }));
    const reviews = await new WootReviews(settings).collect({ source: "amazon", asin: "B0CDN5DNK1" }, 3);
    expect(reviews.map((r) => [r.rating, r.body])).toEqual([[3, "Doesn't do much"], [3, "meh"], [1, "awful"]]);
    expect(reviews[0]).toMatchObject({ review_date: "2026-06-17", verified: true, helpful_votes: 10 });
  });
});

describe("a store page", () => {
  it("names the review apps its theme loads", () => {
    expect(ShopifyStorefront.apps('<script>window.jdgmSettings={"pagination":5}</script>')).toEqual(["judgeme"]);
    expect(ShopifyStorefront.apps('<div class="yotpo-widget"></div>')).toEqual(["yotpo"]);
  });

  it("is never fetched from this machine or a private network", () => {
    for (const url of ["http://localhost/products/x", "http://127.0.0.1/products/x", "http://10.0.0.4/x", "http://[::1]/x", "file:///etc/passwd", "http://metadata.internal/x"]) {
      expect(() => PublicUrls.assert(url), url).toThrow(/refusing/);
    }
    expect(PublicUrls.assert("https://mullevia.com/products/drops").hostname).toBe("mullevia.com");
  });

  it("gives an ASIN only for an Amazon product url", () => {
    expect(Asins.fromUrl("https://www.amazon.com/Mullein-Drops/dp/B0CDN5DNK1?th=1")).toBe("B0CDN5DNK1");
    expect(Asins.fromUrl("https://www.amazon.co.uk/gp/product/B0CDN5DNK1/")).toBe("B0CDN5DNK1");
    expect(Asins.fromUrl("https://www.amazon.com/clp/B08LP4NG6M")).toBe("B08LP4NG6M");
    expect(Asins.fromUrl("https://notamazon.com/dp/B0CDN5DNK1")).toBeNull();
  });
});

class FakeStorefront implements Storefront {
  async inspect(url: string): Promise<StorefrontFacts | null> {
    if (url === PRODUCT_URL) return { shop_domain: "mullevia.myshopify.com", product_id: "157", review_apps: ["judgeme"] };
    if (url === GUMMIES_URL) return { shop_domain: "gummies.myshopify.com", product_id: "9", review_apps: ["okendo"] };
    return null;
  }
}

class FakeSource implements ReviewSource {
  readonly asked: ReviewListing[] = [];

  constructor(
    readonly name: ReviewSourceName,
    private readonly count: number,
  ) {}

  async collect(listing: ReviewListing, limit: number): Promise<CollectedReview[]> {
    this.asked.push(listing);
    const key = listing.source === "amazon" ? listing.asin : listing.product_id;
    return Array.from({ length: Math.min(this.count, limit) }, (_, i) => ({
      source: this.name, source_review_id: `${key}-${i}`, rating: (i % 5) + 1, title: "", body: `${this.name} ${key} review ${i}`, review_date: "2026-09-01", verified: true, helpful_votes: 0, country: null,
    }));
  }
}

describe("stage 3", () => {
  let pg: PostgresStores;
  beforeAll(async () => {
    pg = await PostgresStores.start();
  });
  afterAll(async () => {
    await pg.stop();
  });

  it("collects up to the limit per product from the store widget then Amazon, finds a missing Amazon listing by search, and says what it could not read", async () => {
    const amazonUrl = "https://www.amazon.com/LungClear-Mullein/dp/B0LUNGCLR1";
    const judgeme = new FakeSource("judgeme", 31);
    const amazon = new FakeSource("amazon", 1000);
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [ScriptedAgents.call("web_fetch", { url: PRODUCT_URL }), ScriptedAgents.call("web_search", { query: "x" }), ScriptedAgents.call("submit", RESOLUTION)])
        .on("Product: Mullein Drops", [ScriptedAgents.call("submit", { amazon_url: null, why: "only sold on its own store" })])
        .on("Product: LungClear Mullein Tincture", [ScriptedAgents.call("web_search", { query: "LungClear mullein amazon" }), ScriptedAgents.call("submit", { amazon_url: amazonUrl, why: "same tincture" })])
        .on("Product: Breathe Mullein Gummies", [ScriptedAgents.call("submit", { amazon_url: null, why: "not on Amazon" })])
        .steps(),
    );
    const web = new FakeWeb(PAGES, [...SEARCH_HITS, { title: "LungClear on Amazon", url: amazonUrl, snippet: "" }]);
    const stage = new ReviewStage(new ReviewListings(new FakeStorefront(), new AmazonListingFinder()), new Map<ReviewSourceName, ReviewSource>([["judgeme", judgeme], ["amazon", amazon]]), 500);
    const { traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: web.services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline: new Pipeline([stage]) });
    const driver = new RunDriver(app);
    const picks = RESOLUTION.competitors.slice(0, 2).map(({ why: _why, ...pick }) => pick);

    const runId = await driver.start({ product_url: PRODUCT_URL });
    const done = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: picks });

    expect(done.run.stage_status.reviews.status).toBe("completed");
    const { coverage } = await driver.json<{ coverage: { competitor_id: string | null; source: string; reviews: number }[] }>(`/runs/${runId}/reviews`);
    const lungclear = done.competitors.find((c) => c.brand === "LungClear")!.id;
    const breathe = done.competitors.find((c) => c.brand === "Breathe")!.id;
    expect(coverage.map((row) => [row.competitor_id, row.source, row.reviews])).toEqual([[null, "judgeme", 31], [lungclear, "amazon", 500]]);
    expect(amazon.asked).toEqual([{ source: "amazon", asin: "B0LUNGCLR1" }]);
    expect(done.run.stage_status.reviews.summary).toContain("Breathe Mullein Gummies: 0 new (review app okendo not supported yet, no Amazon listing (not on Amazon))");
    expect(done.run.stage_status.reviews.summary).toMatch(/^531 reviews stored\./);
    const page = await driver.json<{ reviews: { rating: number }[] }>(`/runs/${runId}/reviews?competitor=${lungclear}&limit=5`);
    expect(page.reviews.map((r) => r.rating)).toEqual([1, 1, 1, 1, 1]);
    expect(breathe).toBeTruthy();
  });

  it("records a store's review app only when that app returned reviews, and says when an installed one holds none", async () => {
    const empty = new FakeSource("judgeme", 0);
    const amazon = new FakeSource("amazon", 0);
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [ScriptedAgents.call("web_fetch", { url: PRODUCT_URL }), ScriptedAgents.call("web_search", { query: "x" }), ScriptedAgents.call("submit", RESOLUTION)])
        .on("Product: Mullein Drops", [ScriptedAgents.call("submit", { amazon_url: null, why: "only on its own store" })])
        .on("Product: LungClear", [ScriptedAgents.call("submit", { amazon_url: null, why: "not on Amazon" })])
        .steps(),
    );
    const stage = new ReviewStage(new ReviewListings(new FakeStorefront(), new AmazonListingFinder()), new Map<ReviewSourceName, ReviewSource>([["judgeme", empty], ["amazon", amazon]]), 500);
    const { traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: new FakeWeb(PAGES, SEARCH_HITS).services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline: new Pipeline([stage]) });
    const driver = new RunDriver(app);
    const runId = await driver.start({ product_url: PRODUCT_URL });
    const done = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: RESOLUTION.competitors.slice(0, 1).map(({ why: _why, ...pick }) => pick) });

    expect(done.run.stage_status.reviews.status).toBe("invalid");
    expect(done.run.stage_status.reviews.summary).toContain("Mullein Drops: 0 new (Judge.me is installed but holds no reviews for this product");
    expect(done.product?.url).toBe(PRODUCT_URL);
    const row = await pg.db.get<{ review_app: string | null }>("SELECT review_app FROM products WHERE id = ?", [done.product!.id]);
    expect(row?.review_app).toBeNull();
  });

  it("stores a review once per product, however often it is collected", async () => {
    const product = await pg.store.products.upsert("admin", "https://dedupe.example/p", "P", "");
    const target = { product_id: product.id, competitor_id: null, name: "P", url: product.url };
    const review: CollectedReview = { source: "amazon", source_review_id: "w1", rating: 4, title: "", body: "Works  well", review_date: null, verified: null, helpful_votes: 0, country: null };
    expect(await pg.store.reviews.save("admin", target, [review, { ...review, source_review_id: "w2", body: "works well" }])).toBe(1);
    expect(await pg.store.reviews.save("admin", target, [review])).toBe(0);
  });
});
