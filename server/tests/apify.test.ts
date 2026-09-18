/**
 * The Apify review boundary.
 *
 * The runner is stubbed, so these test our handling of the actors rather than
 * the actors themselves. Every fixture below is a **real shape observed from a
 * live run on 2026-09-17** (`spec-review-mining.md` §5.6–§5.8b), because the
 * actors' documented field names are wrong — `reviewDescription` not `text`,
 * `ratingScore` not `rating` — and an adapter written from the READMEs returns
 * `undefined` for every excerpt while looking like an empty source.
 *
 * The behaviours worth protecting are all failures that *look like success*:
 * an empty dataset on a finished run, an error record billed as a result, and a
 * star filter that returns the wrong band.
 */

import { describe, expect, it } from "vitest";

import {
  AMAZON_REVIEWS_ACTOR,
  AMAZON_SEARCH_ACTOR,
  MIN_CAP_USD,
  capFor,
  TRUSTPILOT_ACTOR,
  amazonReviews,
  findAmazonProducts,
  trustpilotReviews,
  type ActorRunner,
} from "../src/apify.js";

interface Call {
  actorId: string;
  input: Record<string, unknown>;
  cap: number;
}

/** Records what was asked for, replays what the live actors returned. */
function stub(
  items: Array<Record<string, unknown>>,
  status = "SUCCEEDED",
): { runner: ActorRunner; calls: Call[] } {
  const calls: Call[] = [];
  const runner: ActorRunner = {
    async run(actorId, input, cap) {
      calls.push({ actorId, input, cap });
      return { status, items };
    },
  };
  return { runner, calls };
}

/** An Amazon review as the live actor emits it. */
const amazonRow = (star: number, text: string, extra: Record<string, unknown> = {}) => ({
  reviewTitle: "a title",
  reviewDescription: text,
  ratingScore: star,
  date: "2026-09-09",
  reviewUrl: "https://www.amazon.com/gp/customer-reviews/R123",
  reviewId: "R123",
  isVerified: true,
  isAmazonVine: false,
  totalCategoryRatings: 61,
  totalCategoryReviews: 28,
  ...extra,
});

describe("amazonReviews", () => {
  it("maps the live field names, which are not the documented ones", async () => {
    const { runner } = stub([amazonRow(3, "It works but you must reapply several times a day.")]);
    const result = await amazonReviews(runner, {
      productUrl: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
      maxReviews: 10,
    });

    expect(result.excerpts).toHaveLength(1);
    expect(result.excerpts[0]).toMatchObject({
      text: "It works but you must reapply several times a day.",
      star: 3,
      date: "2026-09-09",
      verified: true,
      source: "amazon",
    });
    expect(result.gap).toBeNull();
    // Ratings >> written reviews is the shape of most categories; both are
    // surfaced so a thin product is visible rather than merely disappointing.
    expect(result.totalRatings).toBe(61);
    expect(result.totalReviews).toBe(28);
  });

  it("asks for one discrete band and caps spend at the actor's enforced floor", async () => {
    const { runner, calls } = stub([amazonRow(3, "fine")]);
    await amazonReviews(runner, {
      productUrl: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
      maxReviews: 7,
    });

    expect(calls[0]!.actorId).toBe(AMAZON_REVIEWS_ACTOR);
    expect(calls[0]!.input.filterByRatings).toEqual(["threeStar"]);
    expect(calls[0]!.input.maxReviews).toBe(7);
    // `helpful` re-inherits Amazon's popularity skew, which is the bias we are
    // paying to escape.
    expect(calls[0]!.input.sort).toBe("recent");
    expect(calls[0]!.input.includeGdprSensitive).toBe(false);
    // Below this, Apify rejects the call outright with a 400.
    expect(calls[0]!.cap).toBe(MIN_CAP_USD[AMAZON_REVIEWS_ACTOR]);
  });

  it("treats no_relevant_reviews_found as a gap, not a failure or an empty result", async () => {
    // Observed live for B0H2JVQ9GR: 61 ratings, 28 written reviews, and zero
    // 3-star reviews carrying text. This record is billed as a result.
    const { runner } = stub([
      {
        error: "no_relevant_reviews_found",
        errorDescription: "No relevant reviews found, saving only review category data...",
        totalCategoryRatings: 61,
        totalCategoryReviews: 0,
        filterByRating: "threeStar",
        productAsin: "B0H2JVQ9GR",
      },
    ]);

    const result = await amazonReviews(runner, {
      productUrl: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
      maxReviews: 10,
    });

    expect(result.excerpts).toEqual([]);
    expect(result.gap).toContain("No 3-star reviews with text");
    expect(result.gap).toContain("61 ratings exist");
    expect(result.totalRatings).toBe(61);
  });

  it("discards rows whose star does not match the band requested", async () => {
    // Amazon's own `filterByStar=one_star` returns the UNFILTERED sample, which
    // would enter the corpus as 1-star reviews that are mostly 5-star. If the
    // actor ever does the same, the rows are fabricated star data.
    const { runner } = stub([
      amazonRow(3, "a real three star"),
      amazonRow(5, "not what was asked for"),
      amazonRow(5, "nor this"),
    ]);

    const result = await amazonReviews(runner, {
      productUrl: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
      maxReviews: 10,
    });

    expect(result.excerpts).toHaveLength(1);
    expect(result.discarded).toBe(2);
    expect(result.gap).toContain("Star data from this call is not trustworthy");
  });

  it("keeps a mixed spread when no band was requested", async () => {
    const { runner, calls } = stub([amazonRow(1, "bad"), amazonRow(5, "good")]);
    const result = await amazonReviews(runner, {
      productUrl: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: null,
      maxReviews: 10,
    });

    expect(calls[0]!.input.filterByRatings).toEqual(["allStars"]);
    expect(result.excerpts).toHaveLength(2);
    expect(result.discarded).toBe(0);
  });

  it("gaps an empty dataset instead of reporting no reviews", async () => {
    // The Apify-shaped "a wall fetches successfully": well-formed JSON saying
    // nothing. Recording it as "this product has no reviews" is the failure
    // that put page furniture in the corpus in run `yoracare`.
    const { runner } = stub([]);
    const result = await amazonReviews(runner, {
      productUrl: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
      maxReviews: 10,
    });

    expect(result.excerpts).toEqual([]);
    expect(result.gap).toContain("empty dataset");
    expect(result.gap).toContain("not evidence the product has no reviews");
  });

  it("skips rows with no review text rather than storing an empty excerpt", async () => {
    const { runner } = stub([amazonRow(3, "   "), amazonRow(3, "real text")]);
    const result = await amazonReviews(runner, {
      productUrl: "https://www.amazon.com/dp/B0H2JVQ9GR",
      star: 3,
      maxReviews: 10,
    });
    expect(result.excerpts).toHaveLength(1);
    expect(result.excerpts[0]!.text).toBe("real text");
  });
});

describe("trustpilotReviews", () => {
  /** A Trustpilot review as the live actor emits it. */
  const row = (star: number, text: string) => ({
    id: "tp-1",
    title: "a title",
    text,
    rating: star,
    experiencedDate: "2026-09-01T00:00:00.000Z",
    publishedDate: "2026-09-11T00:00:00.000Z",
    url: "https://www.trustpilot.com/reviews/tp-1",
    isVerified: true,
  });

  it("maps fields and prefers experiencedDate over publishedDate", async () => {
    const { runner, calls } = stub([
      row(3, "Product itself is ok, what was really bad was the experience with the order"),
    ]);
    const result = await trustpilotReviews(runner, {
      domainOrUrl: "huel.com",
      star: 3,
      maxItems: 10,
    });

    expect(calls[0]!.actorId).toBe(TRUSTPILOT_ACTOR);
    expect(calls[0]!.input.filterStars).toEqual(["3"]);
    expect(calls[0]!.cap).toBe(MIN_CAP_USD[TRUSTPILOT_ACTOR]);
    expect(result.excerpts[0]).toMatchObject({
      star: 3,
      // When the customer had the experience, not when Trustpilot posted it.
      date: "2026-09-01T00:00:00.000Z",
      source: "trustpilot",
    });
  });

  it("never enables the paid LLM summarisation options", async () => {
    // painPointAnalysis is $0.05/event — 67x the per-item rate — and produces a
    // vendor's paraphrase, which spec-stage-1.md §2.3 forbids in an excerpt
    // regardless of price. One boolean away at all times.
    const { runner, calls } = stub([row(3, "text")]);
    await trustpilotReviews(runner, { domainOrUrl: "huel.com", star: 3, maxItems: 5 });

    expect(calls[0]!.input.painPointAnalysis).toBeUndefined();
    expect(calls[0]!.input.reviewInsights).toBeUndefined();
  });

  it("discards rows whose star does not match", async () => {
    const { runner } = stub([row(3, "asked for this"), row(1, "did not ask for this")]);
    const result = await trustpilotReviews(runner, {
      domainOrUrl: "huel.com",
      star: 3,
      maxItems: 10,
    });
    expect(result.excerpts).toHaveLength(1);
    expect(result.discarded).toBe(1);
    expect(result.gap).toContain("other ratings came back");
  });
});

describe("findAmazonProducts", () => {
  it("ranks by reviewsCount and builds the url the reviews actor needs", async () => {
    // The actor returns `url` empty; without construction the next step has
    // nothing to call. Ranking matters because four hand-picked ASINs had 5, 2,
    // 14 and 10 reviews while this search surfaced 61 and 52.
    const { runner, calls } = stub([
      { asin: "B0HFXKNB61", title: "thin listing", stars: 5, reviewsCount: 4, url: "" },
      { asin: "B0H2JVQ9GR", title: "worth mining", stars: 3.9, reviewsCount: 61, url: "" },
      { asin: "B0H4X2HJT2", title: "also good", stars: 4.1, reviewsCount: 52, url: "" },
    ]);

    const products = await findAmazonProducts(runner, {
      query: "intertrigo cream",
      maxResults: 5,
    });

    expect(calls[0]!.actorId).toBe(AMAZON_SEARCH_ACTOR);
    expect(calls[0]!.input.categoryUrls).toEqual([
      { url: "https://www.amazon.com/s?k=intertrigo%20cream" },
    ]);
    expect(products.map((p) => p.asin)).toEqual(["B0H2JVQ9GR", "B0H4X2HJT2", "B0HFXKNB61"]);
    expect(products[0]!.url).toBe("https://www.amazon.com/dp/B0H2JVQ9GR");
    expect(products[0]!.reviewsCount).toBe(61);
  });

  it("ignores rows with no asin", async () => {
    const { runner } = stub([{ title: "sponsored slot", reviewsCount: 9 }, { asin: "B01", title: "real" }]);
    const products = await findAmazonProducts(runner, { query: "x", maxResults: 5 });
    expect(products).toHaveLength(1);
    expect(products[0]!.asin).toBe("B01");
  });
});

describe("spend caps", () => {
  it("sizes the cap from the volume requested, not from the actor's floor", () => {
    // Found live: AMAZON_SEARCH_ACTOR accepts its own $0.005 minimum and then
    // dies with "Charge limit has already been reached" because one result
    // costs $0.012 — returning an empty dataset that reads as "no products".
    expect(capFor(AMAZON_SEARCH_ACTOR, 5)).toBeGreaterThanOrEqual(5 * 0.012);
    expect(capFor(AMAZON_SEARCH_ACTOR, 5)).toBeGreaterThan(MIN_CAP_USD[AMAZON_SEARCH_ACTOR]);
  });

  it("never drops below the floor Apify will accept", () => {
    // Below these, the call is rejected outright with a 400.
    expect(capFor(AMAZON_REVIEWS_ACTOR, 1)).toBe(MIN_CAP_USD[AMAZON_REVIEWS_ACTOR]);
    expect(capFor(TRUSTPILOT_ACTOR, 1)).toBe(MIN_CAP_USD[TRUSTPILOT_ACTOR]);
  });

  it("covers Trustpilot's per-run start fee as well as the items", () => {
    // $0.05 of a $0.0538 bill was the start fee; a cap sized on items alone
    // would not pay for the run at all.
    expect(capFor(TRUSTPILOT_ACTOR, 1000)).toBeGreaterThan(0.05 + 1000 * 0.00075);
  });
});

describe("findAmazonProducts failure handling", () => {
  it("throws on an empty dataset rather than reporting no products", async () => {
    // "No products matched" is a conclusion about Amazon drawn from a failure
    // of ours. The distinction is the whole point of the wall detector.
    const { runner } = stub([], "FAILED");
    await expect(
      findAmazonProducts(runner, { query: "intertrigo cream", maxResults: 5 }),
    ).rejects.toThrow(/failed lookup, not proof/);
  });
});
