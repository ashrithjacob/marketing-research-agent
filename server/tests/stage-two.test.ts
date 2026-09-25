/**
 * Stage-2 wiring smoke tests: the roster stage 1 hands over, the plan a human
 * approves, and the gate that unlocks stage 2 — all without running the agent
 * loop for more than the gate itself needs.
 */

import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { createModels, type MutableModels } from "@earendil-works/pi-ai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/http/index.js";
import { PromptBuilder, RunSupervisor } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { StageTwoRoster } from "../src/extract/index.js";
import { StageTwoHandoff, StageTwoPlanner } from "../src/agent/index.js";
import type { Brief, StagePacket } from "../src/domain/index.js";
import { SqliteResearchStore } from "../src/adapters/index.js";

import { fenced, minimalPacket } from "./fixtures.js";

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
  dir = mkdtempSync(join(tmpdir(), "mra-stage-two-"));
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

/** A stage-1 packet the way a real run leaves it: reference plus a direct and an indirect. */
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
        shared_actives: ["magnesium glycinate"],
        source_id: "sha256:aaa",
      },
      {
        id: "c2",
        name: "SleepMist spray",
        url: "https://sleepmist.example/p",
        relation: "indirect",
        form: "spray",
        active_ingredients: [active],
        shared_actives: ["Magnesium Glycinate"],
        source_id: "sha256:aaa",
      },
    ],
  });
}

async function seedStageOne(briefProduct = "MagnaCalm 400mg"): Promise<string> {
  const run = store.createRun({
    brief: { product: briefProduct, url: "", market: "UK", notes: "" },
    model: "faux-model",
    rejectKinds: [],
    judgementIds: [],
    nodes: ["product_data", "competitors", "category_data"],
    stage: 1,
  });
  store.updateRun(run.id, { status: "completed", packet: rosterPacket() });
  return run.id;
}

const BRIEF: Brief = { product: "MagnaCalm 400mg", url: "", market: "UK", notes: "" };

describe("the stage-2 roster", () => {
  it("reads the product reference and the competitors out of the stage-1 packet", () => {
    const targets = StageTwoRoster.of(rosterPacket() as unknown as StagePacket);
    expect(targets.map((t) => t.id)).toEqual(["product", "c1", "c2"]);
    expect(targets[0]).toMatchObject({ relation: "product", form: "capsule" });
    expect(targets[2]).toMatchObject({ relation: "indirect", form: "spray" });
  });

  it("selects the approved subset", () => {
    const targets = StageTwoRoster.of(rosterPacket() as unknown as StagePacket);
    expect(StageTwoRoster.select(targets, ["c1"]).map((t) => t.id)).toEqual(["c1"]);
  });

  it("falls back to the whole roster when the selection names nothing known", () => {
    const targets = StageTwoRoster.of(rosterPacket() as unknown as StagePacket);
    expect(StageTwoRoster.select(targets, ["nope"])).toEqual(targets);
  });
});

describe("the stage-2 estimate", () => {
  it("prices resolver + five banded pulls per target, plus one Trustpilot run", () => {
    const targets = StageTwoRoster.of(rosterPacket() as unknown as StagePacket);
    const plan = new StageTwoPlanner(10).plan(targets, "run-1")!;
    expect(plan.estimate.targets).toBe(3);
    expect(plan.estimate.reviews_per_target).toBe(50);
    expect(plan.estimate.reviews).toBe(150);
    expect(plan.estimate.amazon_usd).toBeCloseTo(3 * 0.012 + 150 * 0.005, 4);
    expect(plan.estimate.trustpilot_usd).toBeCloseTo(0.05 + 150 * 0.00075, 4);
    expect(plan.estimate.cost_usd).toBeCloseTo(
      plan.estimate.amazon_usd + plan.estimate.trustpilot_usd,
      4,
    );
    expect(plan.estimate.arithmetic).toMatch(/3 targets/);
  });

  it("shrinks with the approved subset", () => {
    const targets = StageTwoRoster.of(rosterPacket() as unknown as StagePacket);
    const full = new StageTwoPlanner(10).plan(targets, "run-1")!;
    const one = new StageTwoPlanner(10).plan([targets[0]!], "run-1")!;
    expect(one.estimate.cost_usd).toBeLessThan(full.estimate.cost_usd);
  });
});

describe("the plan route", () => {
  it("says not-ready before stage 1 exists", async () => {
    const response = await post("/api/research/stage2/plan", { brief: { product: "MagnaCalm" } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ready: boolean; detail: string };
    expect(body.ready).toBe(false);
    expect(body.detail).toMatch(/no stage-1 packet/);
  });

  it("returns the roster and the cost once stage 1 has a packet", async () => {
    const runId = await seedStageOne();
    const response = await post("/api/research/stage2/plan", {
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

    const subset = await post("/api/research/stage2/plan", {
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
    const response = await post("/api/research/stage2/plan", {
      brief: { product: "Yoracare Bar" },
    });
    const body = (await response.json()) as { ready: boolean };
    expect(body.ready).toBe(true);
  });
});

describe("the stage-2 gate", () => {
  it("409s without a stage-1 packet, starts once it exists, and hands the roster in", async () => {
    const blocked = await post("/api/research/runs", {
      brief: { product: "MagnaCalm 400mg" },
      nodes: ["review_mining"],
    });
    expect(blocked.status).toBe(409);
    expect(((await blocked.json()) as any).detail).toMatch(/run stage 1 for this brief first/);

    await seedStageOne();
    faux.setResponses([fauxAssistantMessage(fenced(minimalPacket({ stage: 2 })))]);
    const allowed = await post("/api/research/runs", {
      brief: { product: "magna calm 400mg" },
      nodes: ["review_mining"],
    });
    expect(allowed.status).toBe(200);
    const run = (await allowed.json()) as { id: string; stage: number };
    expect(run.stage).toBe(2);
    await app.supervisor.waitFor(run.id);

    const calls = store.listLlmCalls(run.id);
    const seen = calls.map((call) => JSON.stringify(call.input)).join("\n");
    expect(seen).toMatch(/Targets from stage 1/);
    expect(seen).toMatch(/SleepMist spray/);
  });

  it("stays shut for a stage-1 run whose packet is absent", async () => {
    const run = store.createRun({
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

describe("the stage-2 instructions", () => {
  it("carry the roster and mark out-of-scope targets", () => {
    const targets = StageTwoRoster.of(rosterPacket() as unknown as StagePacket);
    const text = new PromptBuilder().instructions({
      brief: BRIEF,
      rejectKinds: [],
      judgements: [],
      nodes: ["review_mining"],
      roster: targets,
      targets: ["product", "c1"],
    });
    expect(text).toMatch(/Targets from stage 1/);
    expect(text).toMatch(/CalmWell 400/);
    expect(text).toMatch(/indirect competitor \(out of scope this run\): SleepMist spray/);
    expect(text).toMatch(/mine \*\*only\*\* the targets below/i);
  });

  it("marks nothing when every target is approved", () => {
    const targets = StageTwoRoster.of(rosterPacket() as unknown as StagePacket);
    const text = new PromptBuilder().instructions({
      brief: BRIEF,
      rejectKinds: [],
      judgements: [],
      nodes: ["review_mining"],
      roster: targets,
      targets: targets.map((t) => t.id),
    });
    expect(text).toMatch(/indirect competitor: SleepMist spray/);
  });
});

describe("the hand-off", () => {
  it("returns null for a subject stage 1 never ran", () => {
    const handoff = new StageTwoHandoff(store);
    expect(handoff.forBrief({ product: "Nobody", url: "", market: "", notes: "" })).toBeNull();
  });

  it("refuses a stage-2 packet posing as stage 1", async () => {
    const run = store.createRun({
      brief: { product: "WrongStage", url: "", market: "", notes: "" },
      model: "faux-model",
      rejectKinds: [],
      judgementIds: [],
      nodes: ["review_mining"],
      stage: 2,
    });
    store.updateRun(run.id, { status: "completed", packet: rosterPacket() });
    const handoff = new StageTwoHandoff(store);
    expect(handoff.forBrief({ product: "WrongStage", url: "", market: "", notes: "" })).toBeNull();
  });
});
