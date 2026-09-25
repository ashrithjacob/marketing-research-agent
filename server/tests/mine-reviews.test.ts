/**
 * `mine_reviews`: the whole stage-2 pull in one tool call.
 *
 * Measured on 2026-09-25 (run ad900f76…, 32 minutes): the agent spread its
 * Apify calls over about ten turns, each turn waited for its slowest pull, and
 * 1,650s of the run was spent in those waits against 268s of model time. One
 * call that fans every band out at once turns ten waits into one.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AMAZON_REVIEWS_ACTOR, TRUSTPILOT_ACTOR } from "../src/adapters/apify/index.js";
import { RosterBlock } from "../src/agent/prompt/roster-block.js";
import { ResearchToolset } from "../src/agent/tools/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { StageTwoRoster } from "../src/extract/index.js";

let dir: string;
let settings: Settings;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-mine-"));
  settings = { ...Env.settings(), corpusPath: join(dir, "corpus"), apifyMaxReviews: 7, apifyConcurrency: 4 };
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const review = (star: number) => ({ reviewDescription: `a ${star}-star review`, ratingScore: star, reviewUrl: `https://a.test/${star}` });

const recording = (fail?: (input: Record<string, any>) => boolean) => {
  const calls: Array<{ actorId: string; input: Record<string, any> }> = [];
  let inFlight = 0;
  let peak = 0;
  const actorRunner = {
    async run(actorId: string, input: Record<string, any>) {
      calls.push({ actorId, input });
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      if (fail?.(input)) throw new Error("actor run timed out");
      const band = input.filterByRatings?.[0] as string | undefined;
      const star = ["oneStar", "twoStar", "threeStar", "fourStar", "fiveStar"].indexOf(band ?? "") + 1;
      return { status: "SUCCEEDED", items: [star > 0 ? review(star) : { text: "service was fine", rating: 4 }] };
    },
  };
  return { calls, actorRunner, peak: () => peak };
};

const mine = (actorRunner: unknown) =>
  new ResearchToolset({ settings, runId: "run-mine", actorRunner: actorRunner as any })
    .build()
    .find((tool) => tool.name === "mine_reviews")!;

describe("mine_reviews", () => {
  it("pulls every listing at all five bands, and each merchant once, in one call", async () => {
    const { calls, actorRunner } = recording();
    const result = await mine(actorRunner).execute("1", {
      listings: [
        { target_id: "product", product_url: "https://www.amazon.com/dp/B000000001" },
        { target_id: "c1", product_url: "https://www.amazon.com/dp/B000000002" },
      ],
      trustpilot: [{ target_id: "c1", domain: "brand.test" }],
    });

    const amazon = calls.filter((c) => c.actorId === AMAZON_REVIEWS_ACTOR);
    expect(amazon).toHaveLength(10);
    expect(new Set(amazon.map((c) => `${c.input.productUrls[0].url} ${c.input.filterByRatings[0]}`)).size).toBe(10);
    expect(amazon.every((c) => c.input.maxReviews === 7)).toBe(true);
    expect(calls.filter((c) => c.actorId === TRUSTPILOT_ACTOR)).toHaveLength(1);
    expect((result.details as any).pulls).toBe(11);
    expect((result.content[0] as any).text.match(/source_id: /g)).toHaveLength(11);
  });

  it("keeps at most apifyConcurrency actor runs in flight", async () => {
    const { actorRunner, peak } = recording();
    await mine(actorRunner).execute("1", {
      listings: [1, 2, 3].map((n) => ({ target_id: `c${n}`, product_url: `https://www.amazon.com/dp/B00000000${n}` })),
    });
    expect(peak()).toBe(4);
  });

  it("turns one failed pull into a GAP section and still returns the rest", async () => {
    const { actorRunner } = recording((input) => input.filterByRatings?.[0] === "threeStar");
    const result = await mine(actorRunner).execute("1", {
      listings: [{ target_id: "product", product_url: "https://www.amazon.com/dp/B000000001" }],
    });
    const text = (result.content[0] as any).text as string;

    expect(text).toMatch(/Amazon 3-star[\s\S]*GAP: this pull failed — actor run timed out/);
    expect(text.match(/source_id: /g)).toHaveLength(4);
  });
});

describe("a target whose url is already an Amazon listing", () => {
  it("is recognised by its /dp/ or /gp/product/ asin, and a brand site is not", () => {
    expect(StageTwoRoster.amazonListing("https://www.amazon.com/dp/B0H2JVQ9GR")).toBe(true);
    expect(StageTwoRoster.amazonListing("https://www.amazon.co.uk/Some-Name/dp/B0H2JVQ9GR?th=1")).toBe(true);
    expect(StageTwoRoster.amazonListing("https://amazon.com/gp/product/B0H2JVQ9GR")).toBe(true);
    expect(StageTwoRoster.amazonListing("https://www.nowfoods.com/products/supplements/vitamin-d3")).toBe(false);
    expect(StageTwoRoster.amazonListing("")).toBe(false);
  });

  it("is marked in the roster so the agent skips amazon_find_product for it", () => {
    const base = { relation: "direct" as const, form: "capsule" as const, actives: ["vitamin d3"] };
    const text = RosterBlock.text(
      [
        { ...base, id: "c1", name: "Listed", url: "https://www.amazon.com/dp/B0H2JVQ9GR" },
        { ...base, id: "c2", name: "Brand site", url: "https://www.nowfoods.com/products/d3" },
      ],
      [],
    );
    expect(text).toMatch(/\*\*c1\*\*.*Amazon listing known — skip the search/);
    expect(text).not.toMatch(/\*\*c2\*\*.*Amazon listing known/);
  });
});
