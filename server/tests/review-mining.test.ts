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
import { RunSupervisor, StageTwoListings } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { runRequestSchema, stagePacketSchema, type AmazonListing, type MiningTarget, type TargetListing } from "../src/domain/index.js";
import { StageTwoOffer, StageTwoRoster, TrustpilotDomain } from "../src/extract/index.js";

import { minimalPacket, services } from "./fixtures.js";

const BANDS = ["oneStar", "twoStar", "threeStar", "fourStar", "fiveStar"];

let dir: string;
let store: SqliteResearchStore;
let settings: Settings;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-mining-"));
  store = new SqliteResearchStore(join(dir, "research.db"));
  settings = { ...Env.settings(), model: "faux-model", corpusPath: join(dir, "corpus"), apifyMaxReviews: 7, apifyConcurrency: 1, apifyPullRetries: 1 };
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const listing = (asin: string, brand: string, title: string): AmazonListing => ({
  asin, title, brand, url: `https://www.amazon.com/dp/${asin}`, marketplace: "www.amazon.com", price: null, currency: "",
  stars: null, stars_breakdown: null, reviews_count: null, bought_past_month: "", bestseller_ranks: [], amazon_choice: false, thumbnail: "",
});

const competitor = (id: string, name: string, brand: string, url: string) => ({
  id, name, brand, url, relation: "direct", form: "liquid", shared_actives: ["mullein"], source_id: "sha256:aaa",
  active_ingredients: [{ name_as_printed: "Mullein", name_normalised: "mullein" }],
});

/** A completed stage-1 run and the listings its lookup matched: c1 on Amazon, c2 on its own site only, c3 at a retailer only. */
function seedStageOne(extra: Array<ReturnType<typeof competitor>> = [], rows: TargetListing[] = []): string {
  const brief = { product: "", url: "https://mullevia.com/products/mullein-drops", market: "", notes: "" };
  const run = store.createRun({ workspaceId: "admin", brief, model: "m", rejectKinds: [], judgementIds: [], nodes: ["competitors"], stage: 1 });
  store.updateRun(run.id, {
    status: "completed",
    packet: minimalPacket({
      brief,
      competitor_reference: { name: "Mullevia Mullein Drops", form: "liquid", actives: ["mullein"], source_id: "sha256:aaa" },
      competitors: [
        competitor("c1", "Herb Pharm Mullein", "Herb Pharm", "https://herb-pharm.com/mullein"),
        competitor("c2", "Herbify Mullein Extract", "Herbify", "https://myherbify.com/product/mullein"),
        competitor("c3", "Wanderlust Mullein Drops", "Wanderlust", "https://www.chemistwarehouse.com.au/buy/1/wanderlust"),
        ...extra,
      ],
    }),
  });
  const roster = StageTwoRoster.of(stagePacketSchema.parse(store.getRun(run.id)!.packet));
  const strategy = (id: string) => StageTwoListings.strategy(roster.find((t) => t.id === id)!);
  const row = (target_id: string, found: AmazonListing | null, matches: boolean): TargetListing => ({
    source_run_id: run.id, target_id, query: "", strategy: strategy(target_id), listing: found, matches, mismatch: matches ? "" : "brand", error: "", fetched_at: "",
  });
  for (const r of [
    row("product", listing("B00028LNAQ", "Nature's Answer", "Mullein Leaf 1oz"), false),
    row("c1", listing("B000S86S3M", "Herb Pharm", "Herb Pharm Mullein Liquid 1 oz"), true),
    row("c2", null, false),
    row("c3", null, false),
    ...rows.map((x) => ({ ...x, source_run_id: run.id, strategy: strategy(x.target_id) })),
  ]) store.listings.save(r);
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

async function mine(script: Script = happy, targets: string[] = []): Promise<{ runId: string; supervisor: RunSupervisor }> {
  calls.length = 0;
  const actors = {
    run: (actorId: string, input: Record<string, any>, cap: number, signal?: AbortSignal) => (calls.push({ actorId, input, cap }), script(actorId, input, signal)),
  };
  const faux = fauxProvider({ provider: "openrouter", models: [{ id: "faux-model" }] });
  const models = createModels();
  models.setProvider(faux.provider);
  const supervisor = new RunSupervisor({ store, settings, models, services: services(settings, actors), pullRetryDelayMs: 0 });
  const request = runRequestSchema.parse({ brief: { url: "https://mullevia.com/products/mullein-drops" }, nodes: ["review_mining"], targets });
  const runId = supervisor.start(request, "admin");
  return { runId, supervisor };
}

const pulled = () => calls.map((c) => (c.actorId === TRUSTPILOT_ACTOR ? `tp ${c.input.startUrls[0].url}` : `amazon ${c.input.productUrls[0].url} ${c.input.filterByRatings[0]}`));

describe("what stage 2 mines each target from", () => {
  it("mines Amazon where a listing matched, Trustpilot where only the brand's own site exists, and nothing else, with no model", async () => {
    seedStageOne();
    const { runId, supervisor } = await mine();
    await supervisor.waitFor(runId);
    expect(pulled().sort()).toEqual([
      ...BANDS.map((band) => `amazon https://www.amazon.com/dp/B000S86S3M ${band}`),
      "tp mullevia.com",
      "tp myherbify.com",
    ].sort());
    const run = store.getRun(runId)!;
    expect(run).toMatchObject({ status: "completed", packet_source: "pipeline", model: "" });
    expect(store.listLlmCalls(runId)).toHaveLength(0);
    expect((run.packet as any).nodes[0]).toMatchObject({ node: "review_mining", status: "complete" });
    expect(store.listRunReviews(runId)).toHaveLength(7);
    await supervisor.close();
  });

  it("asks Apify for MRA_APIFY_MAX_REVIEWS per pull, and sizes the spend cap from it", async () => {
    seedStageOne();
    const { runId, supervisor } = await mine();
    await supervisor.waitFor(runId);
    const amazon = calls.find((c) => c.actorId === AMAZON_REVIEWS_ACTOR)!;
    expect(amazon.input.maxReviews).toBe(7);
    expect(amazon.cap).toBe(Spend.capFor(AMAZON_REVIEWS_ACTOR, 7));
    await supervisor.close();
  });

  it("archives each pull under an id that re-hashes to the stored bytes", async () => {
    seedStageOne();
    const { runId, supervisor } = await mine();
    await supervisor.waitFor(runId);
    const stored = store.listRunReviews(runId)[0]!;
    const bytes = readFileSync(join(settings.corpusPath, "runs", runId, "sources", stored.source_id.slice(7)));
    expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(stored.source_id);
    await supervisor.close();
  });

  it("mines one listing for one target only: two targets on one listing mine nothing from it, and both are gaps", async () => {
    const twin = listing("B0TWIN0001", "Twin", "Twin Mullein Drops");
    seedStageOne(
      [competitor("c4", "Twin Mullein", "Twin", "https://www.chemistwarehouse.com.au/a"), competitor("c5", "Twin Mullein Two", "Twin", "https://www.chemistwarehouse.com.au/b")],
      [c("c4", twin), c("c5", twin)],
    );
    const { runId, supervisor } = await mine();
    await supervisor.waitFor(runId);
    expect(pulled().some((p) => p.includes("B0TWIN0001"))).toBe(false);
    const gaps = ((store.getRun(runId)!.packet as any).gaps as Array<{ missing: string }>).map((g) => g.missing);
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
    seedStageOne();
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
    expect(store.getRun(runId)!.status).toBe("completed");
    await supervisor.close();
  });

  it("gives up after one retry, with a gap naming both errors", async () => {
    seedStageOne();
    const { runId, supervisor } = await mine(async (actorId, input, signal) =>
      input.filterByRatings?.[0] === "threeStar" ? { status: "FAILED", items: [] } : happy(actorId, input, signal), onlyC1);
    await supervisor.waitFor(runId);
    expect(pulled().filter((p) => p.endsWith("threeStar"))).toHaveLength(2);
    const packet = store.getRun(runId)!.packet as any;
    expect(packet.gaps.map((g: any) => g.missing)).toContain(
      "c1: the pull of https://www.amazon.com/dp/B000S86S3M failed — the Apify run ended FAILED; then the Apify run ended FAILED",
    );
    expect(packet.nodes[0]).toMatchObject({ status: "incomplete", why: "no 3-star review for c1" });
    await supervisor.close();
  });

  it("does not retry a band that has no written reviews: that is an answer", async () => {
    seedStageOne();
    const { runId, supervisor } = await mine(async (actorId, input, signal) =>
      input.filterByRatings?.[0] === "threeStar"
        ? { status: "SUCCEEDED", items: [{ error: "no_relevant_reviews_found", totalCategoryRatings: 40 }] }
        : happy(actorId, input, signal), onlyC1);
    await supervisor.waitFor(runId);
    expect(pulled().filter((p) => p.endsWith("threeStar"))).toHaveLength(1);
    expect(((store.getRun(runId)!.packet as any).gaps as any[]).map((g) => g.missing).join(" ")).toMatch(/No 3-star reviews with text/);
    await supervisor.close();
  });

  it("stops starting pulls once Apify says the account is out of credit", async () => {
    seedStageOne();
    const { runId, supervisor } = await mine(async () => {
      throw new ApifyCreditError(AMAZON_REVIEWS_ACTOR);
    }, onlyC1);
    await supervisor.waitFor(runId);
    expect(calls).toHaveLength(1);
    const gaps = ((store.getRun(runId)!.packet as any).gaps as any[]).map((g) => g.missing);
    expect(gaps.filter((g: string) => g.includes("out of credit"))).toHaveLength(5);
    await supervisor.close();
  });

  it("ends cancelled on Stop, keeping the pulls already done", async () => {
    seedStageOne();
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
    supervisor.stop(runId);
    await supervisor.waitFor(runId);
    expect(store.getRun(runId)!.status).toBe("cancelled");
    expect(store.listRunReviews(runId)).toHaveLength(1);
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
    const offered = StageTwoOffer.of([target("c7", "https://www.chemistwarehouse.com.au/buy/1", "Wanderlust")], []);
    expect(offered).toEqual([]);
  });
});
