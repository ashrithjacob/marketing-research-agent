/**
 * A whole product-truth run with scripted agents (spec-stage-2-product-truth.md
 * §3): the operator's inputs first, then formula, then mechanism beside
 * dose_vs_study, then claim_limits after dose_vs_study and cogs_refills after
 * mechanism, settled once from the ledger. The faux model answers each agent
 * from its own script, picked by the agent name in its system prompt, because
 * the agents in a step call it in no fixed order.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type AssistantMessage } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteResearchStore } from "../src/adapters/index.js";
import { RunSupervisor } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { productTruthPacketSchema, type ProductTruthAgent } from "../src/domain/index.js";
import { App } from "../src/http/index.js";

import { minimalPacket } from "./fixtures.js";

let dir: string;
let store: SqliteResearchStore;
let app: App;
let faux: ReturnType<typeof fauxProvider>;

const BRIEF = { product: "", url: "https://mullevia.com/products/mullevia-mullein-drops", market: "US, UK", notes: "" };
const MULLEVIA = ["Wildcrafted Mullein leaf", "Ginger", "Bromelain", "Cordyceps", "Lemon Peel"];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-truth-"));
  const settings: Settings = { ...Env.settings(), model: "faux-model", corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "", parallelApiKey: "" };
  store = new SqliteResearchStore(join(dir, "research.db"));
  faux = fauxProvider({ provider: "openrouter", models: [{ id: "faux-model" }] });
  const models = createModels();
  models.setProvider(faux.provider);
  app = new App({ settings, store, supervisor: new RunSupervisor({ store, settings, models, retry: { attempts: 1, baseMs: 0, capMs: 0 } }) });
});

afterEach(async () => {
  await app.supervisor.close();
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

const post = (path: string, body: unknown) =>
  app.fetch(new Request(`http://local${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

async function seedStageOne(): Promise<string> {
  const run = (await store.createRun({ workspaceId: "admin", brief: BRIEF, model: "m", rejectKinds: [], judgementIds: [], nodes: ["product_data", "category_data"], stage: 1 }));
  await store.updateRun(run.id, {
    status: "completed",
    packet: minimalPacket({
      brief: BRIEF,
      attributes: [{ id: "a1", node: "product_data", key: "full_ingredient_panel", value: "Wildcrafted Mullein leaf, Ginger, Bromelain, Cordyceps, Lemon Peel — no amounts stated", source_id: "sha256:aaa" }],
    }),
  });
  return run.id;
}

const call = (name: string, item?: Record<string, unknown>) => fauxToolCall(name, (item ? { item } : {}) as Parameters<typeof fauxToolCall>[1]);
const turn = (...calls: ReturnType<typeof call>[]) => fauxAssistantMessage(calls, { stopReason: "toolUse" });
const source = (id: string, node: string) => call("record_source", { id, url: `https://example.test/${id}`, kind: "reference", node });

/** Each agent's turns, ending in finish. */
function scripts(): Record<ProductTruthAgent, AssistantMessage[]> {
  return {
    formula: [
      turn(source("sha256:label", "dose_vs_study"), ...MULLEVIA.map((name) => call("record_active", { name, amount: null, unit: "", in_blend: false, source_id: "sha256:label" })),
        call("record_regimen", { servings_per_day: 2, servings_per_container: 30, directions_as_printed: "Take 1 mL in water twice daily", source_id: "sha256:label" })),
      turn(call("finish")),
    ],
    mechanism: [
      turn(source("sha256:pmc", "mechanism"), ...MULLEVIA.map((active, i) => call("record_mechanism", {
        active, pathway: "acts on airway mucus", time_to_effect: i === 0 ? { value: 3, unit: "weeks" } : { value: 5, unit: "days" },
        magnitude: "no human data", story_weight: i === 0 ? "carrier" : "supporting", source_id: "sha256:pmc",
      }))),
      turn(call("finish")),
    ],
    dose_vs_study: [turn(call("finish"))],
    claim_limits: [
      turn(source("sha256:ftc", "claim_limits"), ...[["US", "meta"], ["US", "google_ads"], ["UK", "meta"]].map(([market, platform]) => call("record_claim_limits", {
        market, platform, permitted: ["Supports respiratory health*"], forbidden: ["Cures chronic cough"], disclaimers: [], evidence_standard: "competent and reliable scientific evidence", source_ids: ["sha256:ftc"],
      })), call("record_gap", { node: "claim_limits", missing: "claims: UK / google_ads: the policy page would not load" })),
      turn(call("finish")),
    ],
    cogs_refills: [
      turn(source("sha256:shop", "cogs_refills"), call("record_price", { label: "1 bottle", amount: 26.95, currency: "USD", units: 1, subscription: false, market: "US", source_id: "sha256:shop" })),
      turn(call("finish")),
    ],
  };
}

/** Answers each model call from the script of the agent named in its system prompt, and records the order agents first spoke in. */
function routeByAgent(script: Record<ProductTruthAgent, AssistantMessage[]>, spoke: string[]): void {
  const queues = Object.fromEntries(Object.entries(script).map(([id, turns]) => [id, [...turns]]));
  const total = Object.values(script).reduce((n, turns) => n + turns.length, 0);
  faux.setResponses(Array.from({ length: total }, () => (context: { messages: unknown[] }) => {
    const agent = /You are the `(\w+)` agent/.exec(JSON.stringify(context.messages))?.[1] ?? "";
    if (!spoke.includes(agent)) spoke.push(agent);
    return queues[agent]?.shift() ?? fauxAssistantMessage("nothing scripted");
  }));
}

describe("a product-truth run", () => {
  it("runs the five agents in the spec's order and settles one packet, with every number computed by code", async () => {
    const stageOne = await seedStageOne();
    const spoke: string[] = [];
    routeByAgent(scripts(), spoke);
    const created = await post("/api/research/runs", {
      brief: BRIEF,
      nodes: ["mechanism"],
      inputs: { landed_unit_cost: 4.1, currency: "usd", moq: null, lead_time_days: 30, prices: [{ label: "subscribe 1 bottle", amount: 22.9, currency: "USD", units: 1, subscription: true }] },
    });
    expect(created.status).toBe(200);
    const { id, stage, nodes } = (await created.json()) as { id: string; stage: number; nodes: string[] };
    expect(stage).toBe(2);
    expect(nodes).toEqual(["mechanism", "dose_vs_study", "claim_limits", "cogs_refills"]);
    await app.supervisor.waitFor(id);

    const run = (await store.getRun(id))!;
    expect(run.error).toBe("");
    expect(run.status).toBe("completed");
    expect(run.source_run_id).toBe(stageOne);
    expect(spoke[0]).toBe("formula");
    expect(spoke.indexOf("claim_limits")).toBeGreaterThan(spoke.indexOf("dose_vs_study"));
    expect(spoke.indexOf("cogs_refills")).toBeGreaterThan(spoke.indexOf("mechanism"));

    const packet = productTruthPacketSchema.parse(run.packet);
    expect(packet.doses.map((d) => d.class)).toEqual(Array(5).fill("unassessable"));
    expect(packet.economics).toMatchObject({ days_of_supply: 15, operator: { landed_unit_cost: 4.1, currency: "USD", moq: null } });
    expect(packet.economics.churn).toMatchObject({ mismatch: true, carriers: [{ active: "Wildcrafted Mullein leaf", time_to_effect_days: 21, runs_out_first: true }] });
    expect(packet.economics.margins.map((m) => [m.label, m.margin])).toEqual([["subscribe 1 bottle", 0.821], ["1 bottle", 0.848]]);
    expect(packet.nodes.every((n) => n.status === "complete")).toBe(true);
    expect(packet.gaps.map((g) => g.missing)).toContain("moq: not entered when product truth started");
    expect(packet.guard).toMatch(/not legal advice/);
    expect(new Set((await store.listLlmCalls(id)).map((c) => c.agent_id))).toEqual(new Set(["formula", "mechanism", "dose_vs_study", "claim_limits", "cogs_refills"]));
  });

  it("keeps the packet and ends invalid when an agent leaves an item neither recorded nor gapped", async () => {
    await seedStageOne();
    const script = scripts();
    script.cogs_refills = [fauxAssistantMessage("I could not find any prices.")];
    routeByAgent(script, []);
    const created = await post("/api/research/runs", { brief: BRIEF, nodes: ["cogs_refills"] });
    const { id } = (await created.json()) as { id: string };
    await app.supervisor.waitFor(id);

    const run = (await store.getRun(id))!;
    expect(run.status).toBe("invalid");
    expect(run.error).toMatch(/cogs_refills: `prices` is neither recorded nor gapped/);
    const packet = productTruthPacketSchema.parse(run.packet);
    expect(packet.nodes.find((n) => n.node === "cogs_refills")).toMatchObject({ status: "incomplete", done_criterion_met: false });
    expect(packet.nodes.find((n) => n.node === "mechanism")).toMatchObject({ status: "complete" });
    expect(packet.economics.margins).toEqual([]);
  });

  it("will not start before a completed stage 1 for the brief", async () => {
    const refused = await post("/api/research/runs", { brief: BRIEF, nodes: ["dose_vs_study"] });
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { detail: string }).detail).toMatch(/stage 2 builds on stage 1/);
  });
});
