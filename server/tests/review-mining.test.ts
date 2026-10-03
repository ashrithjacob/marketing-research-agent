/**
 * Stage 2 as a pipeline (spec-stage-2-pipeline.md): no model, the listings
 * stage 1 matched, one retry for a transient pull, and a computed packet.
 *
 * The Apify runner is scripted per call; the model provider has no responses,
 * so any model call would show up in research_llm_calls.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels } from "@earendil-works/pi-ai";
import { fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteResearchStore } from "../src/adapters/index.js";
import {
  AMAZON_REVIEWS_ACTOR,
  ApifyCreditError,
  Spend,
  TRUSTPILOT_ACTOR,
  type ActorRun,
} from "../src/adapters/apify/index.js";
import { RunSupervisor, ReviewMiningListings } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { runRequestSchema, stagePacketSchema, type AmazonListing, type MiningTarget, type TargetListing } from "../src/domain/index.js";
import { ReviewMiningOffer, ReviewMiningRoster, TrustpilotDomain } from "../src/extract/index.js";

import { minimalPacket, services, completeProductTruth } from "./fixtures.js";

const BANDS = ["oneStar", "twoStar", "threeStar", "fourStar", "fiveStar"];

let dir: string;
let store: SqliteResearchStore;
let settings: Settings;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-mining-"));
  store = new SqliteResearchStore(join(dir, "research.db"));
  settings = { ...Env.settings(), model: "faux-model", corpusPath: join(dir, "corpus"), apifyMaxReviews: 7, apifyConcurrency: 1, apifyPullRetries: 1 };
});

afterEach(async () => {
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

const listing = (asin: string, brand: string, title: string): AmazonListing => ({
  asin, title, brand, url: `https://www.amazon.com/dp/${asin}`, marketplace: "www.amazon.com", price: null, currency: "",
  stars: null, stars_breakdown: null, reviews_count: null, bought_past_month: "", bestseller_ranks: [], amazon_choice: false, thumbnail: "",
});

const competitor = (id: string, name: string, brand: string, url: string) => ({
  id, name, brand, url, relation: "direct", form: "liquid", shared_actives: ["mullein"], icp_as_printed: "for coughs and chest congestion", source_id: "sha256:aaa",
  active_ingredients: [{ name_as_printed: "Mullein", name_normalised: "mullein" }],
});

/** A completed stage-1 run and the listings its lookup matched: c1 on Amazon, c2 on its own site only, c3 at a retailer only. */
async function seedStageOne(extra: Array<ReturnType<typeof competitor>> = [], rows: TargetListing[] = [], workspaceId = "admin"): Promise<string> {
  const brief = { product: "", url: "https://mullevia.com/products/mullein-drops", market: "", notes: "" };
  const run = (await store.createRun({ workspaceId, brief, model: "m", rejectKinds: [], judgementIds: [], nodes: ["competitors"], stage: 1 }));
  await store.updateRun(run.id, {
    status: "completed",
    packet: minimalPacket({
      brief,
      competitor_reference: { name: "Mullevia Mullein Drops", form: "liquid", actives: ["mullein"], icp: "adults with a cough", source_id: "sha256:aaa" },
      competitors: [
        competitor("c1", "Herb Pharm Mullein", "Herb Pharm", "https://herb-pharm.com/mullein"),
        competitor("c2", "Herbify Mullein Extract", "Herbify", "https://myherbify.com/product/mullein"),
        competitor("c3", "Wanderlust Mullein Drops", "Wanderlust", "https://www.chemistwarehouse.com.au/buy/1/wanderlust"),
        ...extra,
      ],
    }),
  });
  const roster = ReviewMiningRoster.of(stagePacketSchema.parse((await store.getRun(run.id))!.packet));
  const strategy = (id: string) => ReviewMiningListings.strategy(roster.find((t) => t.id === id)!);
  const row = (target_id: string, found: AmazonListing | null, matches: boolean): TargetListing => ({
    source_run_id: run.id, target_id, query: "", strategy: strategy(target_id), listing: found, matches, mismatch: matches ? "" : "brand", error: "", fetched_at: "",
  });
  for (const r of [
    row("product", listing("B00028LNAQ", "Nature's Answer", "Mullein Leaf 1oz"), false),
    row("c1", listing("B000S86S3M", "Herb Pharm", "Herb Pharm Mullein Liquid 1 oz"), true),
    row("c2", null, false),
    row("c3", null, false),
    ...rows.map((x) => ({ ...x, source_run_id: run.id, strategy: strategy(x.target_id) })),
  ]) await store.listings.save(r);
  await completeProductTruth(store, run.id);
  return run.id;
}

type Script = (actorId: string, input: Record<string, any>, signal?: AbortSignal) => Promise<ActorRun>;
const calls: Array<{ actorId: string; input: Record<string, any>; cap: number }> = [];
const review = (star: number, key: string) => ({ reviewDescription: `a ${star}-star review`, ratingScore: star, reviewId: key, reviewUrl: `https://a.test/${key}` });
const happy: Script = async (actorId, input) => {
  if (actorId === TRUSTPILOT_ACTOR) return { status: "SUCCEEDED", items: [{ text: "merchant review", rating: 3, id: `tp-${input.startUrls[0].url}` }] };
  const star = BANDS.indexOf(input.filterByRatings[0]) + 1;
  return { status: "SUCCEEDED", items: [review(star, `${input.productUrls[0].url}-${star}`)] };
};

async function mine(script: Script = happy, targets: string[] = [], workspaceId = "admin"): Promise<{ runId: string; supervisor: RunSupervisor }> {
  calls.length = 0;
  const actors = {
    run: async (actorId: string, input: Record<string, any>, cap: number, signal?: AbortSignal) => (calls.push({ actorId, input, cap }), (await script(actorId, input, signal))),
  };
  const faux = fauxProvider({ provider: "openrouter", models: [{ id: "faux-model" }] });
  const models = createModels();
  models.setProvider(faux.provider);
  const supervisor = new RunSupervisor({ store, settings, models, services: services(settings, actors), pullRetryDelayMs: 0 });
  const request = runRequestSchema.parse({ brief: { url: "https://mullevia.com/products/mullein-drops" }, nodes: ["review_mining"], targets });
  const runId = (await supervisor.start(request, workspaceId));
  return { runId, supervisor };
}

const pulled = () => calls.map((c) => (c.actorId === TRUSTPILOT_ACTOR ? `tp ${c.input.startUrls[0].url}` : `amazon ${c.input.productUrls[0].url} ${c.input.filterByRatings[0]}`));

describe("what stage 2 mines each target from", () => {
  it("mines Amazon where a listing matched, Trustpilot where only the brand's own site exists, and nothing else, with no model", async () => {
    await seedStageOne();
    const { runId, supervisor } = await mine();
    await supervisor.waitFor(runId);
    expect(pulled().sort()).toEqual([
      ...BANDS.map((band) => `amazon https://www.amazon.com/dp/B000S86S3M ${band}`),
      "tp mullevia.com",
      "tp myherbify.com",
    ].sort());
    const run = (await store.getRun(runId))!;
    expect(run).toMatchObject({ status: "completed", packet_source: "pipeline", model: "" });
    expect((await store.listLlmCalls(runId))).toHaveLength(0);
    expect((run.packet as any).nodes[0]).toMatchObject({ node: "review_mining", status: "complete" });
    expect((await store.listRunReviews(runId))).toHaveLength(7);
    await supervisor.close();
  });

  it("records the stage-1 run it mined, so a later stage 1 does not claim it", async () => {
    // A newer stage-1 run showed the old mining as its own "complete" stage 2.
    const source = await seedStageOne();
    const { runId, supervisor } = await mine();
    await supervisor.waitFor(runId);
    expect((await store.getRun(runId))!.source_run_id).toBe(source);
    await seedStageOne();
    expect((await store.getRun(runId))!.source_run_id).toBe(source);
    await supervisor.close();
  });

  it("asks Apify for MRA_APIFY_MAX_REVIEWS per pull, and sizes the spend cap from it", async () => {
    await seedStageOne();
    const { runId, supervisor } = await mine();
    await supervisor.waitFor(runId);
    const amazon = calls.find((c) => c.actorId === AMAZON_REVIEWS_ACTOR)!;
    expect(amazon.input.maxReviews).toBe(7);
    expect(amazon.cap).toBe(Spend.capFor(AMAZON_REVIEWS_ACTOR, 7));
    await supervisor.close();
  });

  it("archives each pull under an id that re-hashes to the stored bytes", async () => {
    await seedStageOne();
    const { runId, supervisor } = await mine();
    await supervisor.waitFor(runId);
    const stored = (await store.listRunReviews(runId))[0]!;
    const bytes = readFileSync(join(settings.corpusPath, "runs", runId, "sources", stored.source_id.slice(7)));
    expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(stored.source_id);
    await supervisor.close();
  });

  it("mines one listing for one target only: two targets on one listing mine nothing from it, and both are gaps", async () => {
    const twin = listing("B0TWIN0001", "Twin", "Twin Mullein Drops");
    await seedStageOne(
      [competitor("c4", "Twin Mullein", "Twin", "https://www.chemistwarehouse.com.au/a"), competitor("c5", "Twin Mullein Two", "Twin", "https://www.chemistwarehouse.com.au/b")],
      [c("c4", twin), c("c5", twin)],
    );
    const { runId, supervisor } = await mine();
    await supervisor.waitFor(runId);
    expect(pulled().some((p) => p.includes("B0TWIN0001"))).toBe(false);
    const gaps = (((await store.getRun(runId))!.packet as any).gaps as Array<{ missing: string }>).map((g) => g.missing);
    expect(gaps.filter((g) => g.includes("matched c4 and c5"))).toHaveLength(2);
    await supervisor.close();
  });
});

const c = (target_id: string, found: AmazonListing): TargetListing => ({
  source_run_id: "", target_id, query: "", strategy: "", listing: found, matches: true, mismatch: "", error: "", fetched_at: "",
});

describe("a pull that fails", () => {
  const onlyC1 = ["c1"];

  it("retries a transient failure once, and files the retry", async () => {
    await seedStageOne();
    let failed = false;
    const { runId, supervisor } = await mine(async (actorId, input, signal) => {
      if (!failed && input.filterByRatings?.[0] === "threeStar") {
        failed = true;
        return { status: "TIMED-OUT", items: [] };
      }
      return happy(actorId, input, signal);
    }, onlyC1);
    await supervisor.waitFor(runId);
    expect(pulled().filter((p) => p.endsWith("threeStar"))).toHaveLength(2);
    expect((await store.getRun(runId))!.status).toBe("completed");
    await supervisor.close();
  });

  it("gives up after one retry, with a gap naming both errors", async () => {
    await seedStageOne();
    const { runId, supervisor } = await mine(async (actorId, input, signal) =>
      input.filterByRatings?.[0] === "threeStar" ? { status: "FAILED", items: [] } : (await happy(actorId, input, signal)), onlyC1);
    await supervisor.waitFor(runId);
    expect(pulled().filter((p) => p.endsWith("threeStar"))).toHaveLength(2);
    const packet = (await store.getRun(runId))!.packet as any;
    expect(packet.gaps.map((g: any) => g.missing)).toContain(
      "c1: the pull of https://www.amazon.com/dp/B000S86S3M failed — the Apify run ended FAILED; then the Apify run ended FAILED",
    );
    expect(packet.nodes[0]).toMatchObject({ status: "incomplete", why: "no 3-star review for c1" });
    await supervisor.close();
  });

  it("does not retry a band that has no written reviews: that is an answer", async () => {
    await seedStageOne();
    const { runId, supervisor } = await mine(async (actorId, input, signal) =>
      input.filterByRatings?.[0] === "threeStar"
        ? { status: "SUCCEEDED", items: [{ error: "no_relevant_reviews_found", totalCategoryRatings: 40 }] }
        : (await happy(actorId, input, signal)), onlyC1);
    await supervisor.waitFor(runId);
    expect(pulled().filter((p) => p.endsWith("threeStar"))).toHaveLength(1);
    expect((((await store.getRun(runId))!.packet as any).gaps as any[]).map((g) => g.missing).join(" ")).toMatch(/No 3-star reviews with text/);
    await supervisor.close();
  });

  it("stops starting pulls once Apify says the account is out of credit", async () => {
    await seedStageOne();
    const { runId, supervisor } = await mine(async () => {
      throw new ApifyCreditError(AMAZON_REVIEWS_ACTOR);
    }, onlyC1);
    await supervisor.waitFor(runId);
    expect(calls).toHaveLength(1);
    const gaps = (((await store.getRun(runId))!.packet as any).gaps as any[]).map((g) => g.missing);
    expect(gaps.filter((g: string) => g.includes("out of credit"))).toHaveLength(5);
    await supervisor.close();
  });

  it("ends cancelled on Stop, keeping the pulls already done", async () => {
    await seedStageOne();
    let release!: () => void;
    const holding = new Promise<void>((r) => (release = r));
    const { runId, supervisor } = await mine(async (actorId, input, signal) => {
      if (input.filterByRatings?.[0] !== "threeStar") {
        await new Promise<never>((_resolve, reject) => signal?.addEventListener("abort", () => reject(signal.reason), { once: true }));
      }
      release();
      return happy(actorId, input, signal);
    }, onlyC1);
    await holding;
    await new Promise((r) => setTimeout(r, 5));
    await supervisor.stop(runId);
    await supervisor.waitFor(runId);
    expect((await store.getRun(runId))!.status).toBe("cancelled");
    expect((await store.listRunReviews(runId))).toHaveLength(1);
    await supervisor.close();
  });
});

describe("the offer", () => {
  const target = (id: string, url: string, brand = "", relation: MiningTarget["relation"] = "direct"): MiningTarget => ({
    id, name: `${brand} Mullein`, brand, relation, form: "liquid", actives: ["mullein"], url, amazon_url: "", trustpilot: "", note: "",
  });

  it("takes a Trustpilot domain only from a host that carries the brand; the champion's is the brief's", () => {
    expect(TrustpilotDomain.of(target("c1", "https://www.herb-pharm.com/m", "Herb Pharm"))).toBe("herb-pharm.com");
    expect(TrustpilotDomain.of(target("c21", "https://herbpharm.co.uk/p", "Herb Pharm UK"))).toBe("herbpharm.co.uk");
    expect(TrustpilotDomain.of(target("c7", "https://www.chemistwarehouse.com.au/buy/1", "Wanderlust"))).toBe("");
    expect(TrustpilotDomain.of(target("product", "https://mullevia.com/products/x", "", "product"))).toBe("mullevia.com");
  });

  it("drops a target with neither a matched listing nor its own domain", () => {
    const offered = ReviewMiningOffer.of([target("c7", "https://www.chemistwarehouse.com.au/buy/1", "Wanderlust")], []);
    expect(offered).toEqual([]);
  });
});

describe("reusing earlier pulls", () => {
  const onlyC1 = ["c1"];
  const amazonPulls = () => pulled().filter((p) => p.startsWith("amazon"));

  it("answers a second run's bands from the first run's pulls, with no Apify call, and stores the same reviews for it", async () => {
    await seedStageOne();
    const first = await mine(happy, onlyC1);
    await first.supervisor.waitFor(first.runId);
    expect(amazonPulls()).toHaveLength(5);
    await first.supervisor.close();

    const second = await mine(happy, onlyC1);
    await second.supervisor.waitFor(second.runId);
    expect(amazonPulls()).toHaveLength(0);
    expect((await store.listRunReviews(second.runId)).map((r) => r.review_key).sort()).toEqual((await store.listRunReviews(first.runId)).map((r) => r.review_key).sort());
    expect((await store.listEvents(second.runId)).filter((e) => e.kind === "reviews.reused")).toHaveLength(5);
    expect((await store.charges.list(second.runId)).filter((c) => c.service === "apify")).toEqual([]);
    await second.supervisor.close();
  });

  it("serves another workspace from the same pulls: reviews are public pages", async () => {
    await seedStageOne();
    const first = await mine(happy, onlyC1);
    await first.supervisor.waitFor(first.runId);
    await first.supervisor.close();

    await seedStageOne([], [], "client-b");
    const other = await mine(happy, onlyC1, "client-b");
    await other.supervisor.waitFor(other.runId);
    expect((await store.getRun(other.runId))!.workspace_id).toBe("client-b");
    expect(amazonPulls()).toHaveLength(0);
    expect((await store.listRunReviews(other.runId))).toHaveLength(5);
    await other.supervisor.close();
  });

  it("pulls again once the kept pull is older than the reuse window", async () => {
    await seedStageOne();
    const first = await mine(happy, onlyC1);
    await first.supervisor.waitFor(first.runId);
    await first.supervisor.close();
    settings = { ...settings, reviewReuseDays: 0 };
    const again = await mine(happy, onlyC1);
    await again.supervisor.waitFor(again.runId);
    expect(amazonPulls()).toHaveLength(5);
    await again.supervisor.close();
  });

  it("never keeps a refused pull, and still serves kept bands when Apify is out of credit", async () => {
    await seedStageOne();
    const partial = await mine(async (actorId, input, signal) => {
      if (input.filterByRatings?.[0] === "oneStar") throw new ApifyCreditError(AMAZON_REVIEWS_ACTOR);
      return happy(actorId, input, signal);
    }, onlyC1);
    await partial.supervisor.waitFor(partial.runId);
    await partial.supervisor.close();

    const broke = await mine(async () => {
      throw new ApifyCreditError(AMAZON_REVIEWS_ACTOR);
    }, onlyC1);
    await broke.supervisor.waitFor(broke.runId);
    const stars = (await store.listRunReviews(broke.runId)).map((r) => r.star).sort();
    const partialReviews = await store.listRunReviews(partial.runId);
    expect(stars).toEqual([2, 3, 4, 5].filter((s) => partialReviews.some((r) => r.star === s)));
    expect(amazonPulls()).toEqual([`amazon https://www.amazon.com/dp/B000S86S3M oneStar`]);
    await broke.supervisor.close();
  });
});
