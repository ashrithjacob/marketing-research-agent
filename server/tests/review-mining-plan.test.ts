/**
 * Stage-2 wiring smoke tests: the roster stage 1 hands over, the plan a human
 * approves, and the gate that unlocks stage 2 — all without running the agent
 * loop for more than the gate itself needs.
 */
import { Scope } from "../src/domain/index.js";

import { fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { createModels, type MutableModels } from "@earendil-works/pi-ai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/http/index.js";
import { RunSupervisor } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { ReviewMiningRoster } from "../src/extract/index.js";
import { StageOneHandoff, ReviewMiningPlanner } from "../src/agent/index.js";
import type { StagePacket } from "../src/domain/index.js";
import { SqliteResearchStore } from "../src/adapters/index.js";

import { minimalPacket, completeProductTruth } from "./fixtures.js";

let dir: string;
let app: App;
let store: SqliteResearchStore;
let settings: Settings;
let faux: ReturnType<typeof fauxProvider>;
let models: MutableModels;

function build(): App {
  settings = {
    ...Env.settings(),
    model: "faux-model",
    corpusPath: join(dir, "corpus"),
    staticDir: join(dir, "static"),
    appPasswordHash: "",
  };
  store = new SqliteResearchStore(join(dir, "research.db"));
  faux = fauxProvider({ provider: "openrouter", models: [{ id: "faux-model" }] });
  models = createModels();
  models.setProvider(faux.provider);
  const supervisor = new RunSupervisor({
    store,
    settings,
    models,
    retry: { attempts: 3, baseMs: 0, capMs: 0 },
  });
  return new App({ settings, store, supervisor });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-review-mining-"));
  app = build();
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

const post = (path: string, body: unknown) =>
  app.fetch(new Request(`http://test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));

/** A stage-1 packet the way a real run leaves it: reference plus a direct and an indirect by form. */
function rosterPacket(): Record<string, any> {
  const active = {
    name_as_printed: "Magnesium Glycinate",
    name_normalised: "magnesium glycinate",
  };
  return minimalPacket({
    competitor_reference: {
      name: "MagnaCalm 400mg",
      form: "capsule",
      actives: ["magnesium glycinate"],
      source_id: "sha256:aaa",
    },
    competitors: [
      {
        id: "c1",
        name: "CalmWell 400",
        url: "https://calmwell.example/p",
        relation: "direct",
        form: "capsule",
        active_ingredients: [active],
        shared_actives: ["magnesium glycinate"], icp_as_printed: "for restless nights",
        source_id: "sha256:aaa",
      },
      {
        id: "c2",
        name: "SleepMist spray",
        url: "https://sleepmist.example/p",
        relation: "indirect_form",
        form: "spray",
        active_ingredients: [active],
        shared_actives: ["Magnesium Glycinate"], icp_as_printed: "for restless nights",
        source_id: "sha256:aaa",
      },
    ],
  });
}

async function seedStageOne(briefProduct = "MagnaCalm 400mg", withProductTruth = true): Promise<string> {
  const run = store.createRun({
    workspaceId: "admin",
    brief: { product: briefProduct, url: "", market: "UK", notes: "" },
    model: "faux-model",
    rejectKinds: [],
    judgementIds: [],
    nodes: ["product_data", "competitors", "category_data"],
    stage: 1,
  });
  store.updateRun(run.id, { status: "completed", packet: rosterPacket() });
  if (withProductTruth) completeProductTruth(store, run.id);
  return run.id;
}


describe("the review-mining roster", () => {
  it("reads the product reference and the competitors out of the stage-1 packet", () => {
    const targets = ReviewMiningRoster.of(rosterPacket() as unknown as StagePacket);
    expect(targets.map((t) => t.id)).toEqual(["product", "c1", "c2"]);
    expect(targets[0]).toMatchObject({ relation: "product", form: "capsule" });
    expect(targets[2]).toMatchObject({ relation: "indirect_form", form: "spray" });
  });

  it("selects the approved subset", () => {
    const targets = ReviewMiningRoster.of(rosterPacket() as unknown as StagePacket);
    expect(ReviewMiningRoster.select(targets, ["c1"]).map((t) => t.id)).toEqual(["c1"]);
  });

  it("falls back to the whole roster when the selection names nothing known", () => {
    const targets = ReviewMiningRoster.of(rosterPacket() as unknown as StagePacket);
    expect(ReviewMiningRoster.select(targets, ["nope"])).toEqual(targets);
  });
});

describe("the review-mining estimate", () => {
  const offered = () => {
    const [product, c1, c2] = ReviewMiningRoster.of(rosterPacket() as unknown as StagePacket);
    return [
      { ...product!, trustpilot: "magnacalm.example" },
      { ...c1!, amazon_url: "https://www.amazon.com/dp/B0CALMWELL" },
      { ...c2!, amazon_url: "https://www.amazon.com/dp/B0SLEEPMST" },
    ];
  };

  it("prices five banded Amazon pulls per Amazon target, and one Trustpilot pull per Trustpilot target", () => {
    const targets = offered();
    const plan = new ReviewMiningPlanner(10).plan(targets[0]!, targets, targets, "run-1")!;
    expect(plan.estimate.targets).toBe(3);
    expect(plan.estimate.reviews).toBe(2 * 5 * 10 + 10);
    expect(plan.estimate.amazon_usd).toBeCloseTo(100 * 0.005, 4);
    expect(plan.estimate.trustpilot_usd).toBeCloseTo(0.05 + 10 * 0.00075, 4);
    expect(plan.estimate.cost_usd).toBeCloseTo(plan.estimate.amazon_usd + plan.estimate.trustpilot_usd, 4);
    expect(plan.estimate.arithmetic).toMatch(/^2 Amazon targets .* 1 Trustpilot targets/);
  });

  it("shrinks with the approved subset", () => {
    const targets = offered();
    const full = new ReviewMiningPlanner(10).plan(targets[0]!, targets, targets, "run-1")!;
    const one = new ReviewMiningPlanner(10).plan(targets[0]!, targets, [targets[1]!], "run-1")!;
    expect(one.estimate.cost_usd).toBeLessThan(full.estimate.cost_usd);
    expect(one.offered).toHaveLength(3);
  });
});

describe("the plan route", () => {
  it("says not-ready before stage 1 exists", async () => {
    const response = await post("/api/research/review-mining/plan", { brief: { product: "MagnaCalm" } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ready: boolean; detail: string };
    expect(body.ready).toBe(false);
    expect(body.detail).toMatch(/no stage-1 packet/);
  });

  it("returns the roster and the cost once stage 1 has a packet", async () => {
    const runId = await seedStageOne();
    const response = await post("/api/research/review-mining/plan", {
      brief: { product: "magna calm 400mg" },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ready: boolean;
      plan: { source_run_id: string; targets: { id: string }[]; estimate: { cost_usd: number } };
    };
    expect(body.ready).toBe(true);
    expect(body.plan.source_run_id).toBe(runId);
    expect(body.plan.targets.map((t) => t.id)).toEqual(["product", "c1", "c2"]);
    expect(body.plan.estimate.cost_usd).toBeGreaterThan(0);

    const subset = await post("/api/research/review-mining/plan", {
      brief: { product: "magna calm 400mg" },
      targets: ["product"],
    });
    const subsetBody = (await subset.json()) as {
      plan: { targets: { id: string }[]; estimate: { targets: number } };
    };
    expect(subsetBody.plan.targets.map((t) => t.id)).toEqual(["product"]);
    expect(subsetBody.plan.estimate.targets).toBe(1);
  });

  it("matches the brief on the subject, not on spelling", async () => {
    await seedStageOne("yoracare bar");
    const response = await post("/api/research/review-mining/plan", {
      brief: { product: "Yoracare Bar" },
    });
    const body = (await response.json()) as { ready: boolean };
    expect(body.ready).toBe(true);
  });
});

describe("the review-mining gate", () => {
  it("409s without a stage-1 packet, then starts the pipeline, which calls no model", async () => {
    const blocked = await post("/api/research/runs", {
      brief: { product: "MagnaCalm 400mg" },
      nodes: ["review_mining"],
    });
    expect(blocked.status).toBe(409);
    expect(((await blocked.json()) as any).detail).toMatch(/run stage 1 for this brief first/);

    const stageOne = await seedStageOne("MagnaCalm 400mg", false);
    const early = await post("/api/research/runs", { brief: { product: "magna calm 400mg" }, nodes: ["review_mining"] });
    expect(early.status).toBe(409);
    expect(((await early.json()) as any).detail).toMatch(/once product truth \(stage 2\) has completed/);
    const plan = (await (await post("/api/research/review-mining/plan", { brief: { product: "magna calm 400mg" } })).json()) as any;
    expect(plan).toMatchObject({ ready: false });
    expect(plan.detail).toMatch(/Run product truth first/);

    completeProductTruth(store, stageOne);
    const allowed = await post("/api/research/runs", {
      brief: { product: "magna calm 400mg" },
      nodes: ["review_mining"],
    });
    expect(allowed.status).toBe(200);
    const run = (await allowed.json()) as { id: string; stage: number };
    expect(run.stage).toBe(3);
    await app.supervisor.waitFor(run.id);

    expect(store.listLlmCalls(run.id)).toHaveLength(0);
    expect(store.getRun(run.id)).toMatchObject({ status: "failed", error: "APIFY_TOKEN is not set, so no review can be pulled" });
  });

  it("stays shut for a stage-1 run whose packet is absent", async () => {
    const run = store.createRun({
      workspaceId: "admin",
      brief: { product: "EmptyPacket", url: "", market: "", notes: "" },
      model: "faux-model",
      rejectKinds: [],
      judgementIds: [],
      nodes: ["product_data"],
      stage: 1,
    });
    store.updateRun(run.id, { status: "completed", packet: {} });
    const blocked = await post("/api/research/runs", {
      brief: { product: "EmptyPacket" },
      nodes: ["review_mining"],
    });
    expect(blocked.status).toBe(409);
  });
});

describe("the hand-off", () => {
  it("returns null for a subject stage 1 never ran", () => {
    const handoff = new StageOneHandoff(store);
    expect(handoff.forBrief({ product: "Nobody", url: "", market: "", notes: "" }, Scope.everything)).toBeNull();
  });

  it("hands over only a completed stage-1 run, never a newer invalid one that kept its packet", async () => {
    const completed = await seedStageOne();
    const invalid = store.createRun({
      workspaceId: "admin",
      brief: { product: "MagnaCalm 400mg", url: "", market: "UK", notes: "" },
      model: "faux-model",
      rejectKinds: [],
      judgementIds: [],
      nodes: ["product_data", "competitors", "category_data"],
      stage: 1,
    });
    store.updateRun(invalid.id, { status: "invalid", packet: rosterPacket() });
    const handoff = new StageOneHandoff(store);
    expect(handoff.forBrief({ product: "MagnaCalm 400mg", url: "", market: "", notes: "" }, Scope.everything)?.run.id).toBe(completed);
  });

  it("refuses a review-mining packet posing as stage 1", async () => {
    const run = store.createRun({
      workspaceId: "admin",
      brief: { product: "WrongStage", url: "", market: "", notes: "" },
      model: "faux-model",
      rejectKinds: [],
      judgementIds: [],
      nodes: ["review_mining"],
      stage: 3,
    });
    store.updateRun(run.id, { status: "completed", packet: rosterPacket() });
    const handoff = new StageOneHandoff(store);
    expect(handoff.forBrief({ product: "WrongStage", url: "", market: "", notes: "" }, Scope.everything)).toBeNull();
  });
});
