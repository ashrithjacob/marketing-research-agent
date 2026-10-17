/**
 * A whole market-truth run with scripted agents (decided 2026-10-15): market size, offers,
 * sophistication and breaking point side by side, each citing a source stage 1 read by bringing
 * it in with use_source, then the gate after all four; settled once from the ledger as stage 1
 * is. The faux model answers each agent from its own script, picked by the agent name in its
 * system prompt.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type AssistantMessage } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqlResearchStore } from "../src/adapters/index.js";
import { RunSupervisor } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { GATE_DELIVERABLE, SOPHISTICATION_DELIVERABLE, productTruthPacketSchema, stagePacketSchema, type Finding, type MarketTruthAgent } from "../src/domain/index.js";
import { BuyerStages, FieldsCheck, RewordCheck, SophisticationStage } from "../src/extract/index.js";
import { App } from "../src/http/index.js";

import { minimalPacket } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

let dir: string;
let store: SqlResearchStore;
let app: App;
let faux: ReturnType<typeof fauxProvider>;

const BRIEF = { product: "", url: "https://mullevia.com/products/mullevia-mullein-drops", market: "US", notes: "" };

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-market-"));
  const settings: Settings = { ...Env.settings(), model: "faux-model", judgeModel: "faux-model", corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "", parallelApiKey: "" };
  store = await SqliteStores.open(join(dir, "research.db"));
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

const post = (path: string, body: unknown) => app.fetch(new Request(`http://local${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

async function seed(stage: number, packet: Record<string, unknown>): Promise<string> {
  const run = await store.createRun({ workspaceId: "admin", brief: BRIEF, model: "m", rejectKinds: [], judgementIds: [], nodes: stage === 1 ? ["product_data"] : ["mechanism"], stage });
  await store.updateRun(run.id, { status: "completed", packet });
  return run.id;
}

const TRUTH = productTruthPacketSchema.parse({
  contract_version: "1", stage: 2, run_id: "", source_run_id: "", brief: BRIEF, guard: "not legal advice", sources: [], actives: [], regimen: null, mechanisms: [], doses: [], claim_limits: [], prices: [],
  economics: { operator: null, days_of_supply: 30, days_why: "30 servings at one a day", churn: { mismatch: null, why: "no carrier timing", carriers: [] }, margins: [] }, nodes: [], gaps: [],
});

const item = (name: string, payload: Record<string, unknown>) => fauxToolCall(name, { item: payload } as Parameters<typeof fauxToolCall>[1]);
const turn = (...calls: ReturnType<typeof fauxToolCall>[]) => fauxAssistantMessage(calls, { stopReason: "toolUse" });
const use = fauxToolCall("use_source", { source_id: "sha256:aaa" });
const fact = (node: string, key: string, value: string) => item("record_attribute", { node, key, value, source_id: "sha256:aaa" });
const status = (node: string) => item("record_node_status", { node, status: "complete", done_criterion_met: true, why: "every field recorded or gapped" });
const finish = turn(fauxToolCall("finish", {}));

function scripts(): Record<MarketTruthAgent, AssistantMessage[]> {
  return {
    market_size: [
      turn(use, item("record_measurement", { node: "tam_sam", metric: "tam", value: 1200, unit: "USD million", period: "2025", source_id: "sha256:aaa" }),
        item("record_measurement", { node: "tam_sam", metric: "sam", value: 40, unit: "USD million", period: "2025", source_id: "sha256:aaa" }),
        fact("tam_sam", "derivation", "US adults with chronic cough × share buying herbal drops × annual spend"), fact("tam_sam", "sam_assumptions", "Meta and Shopify, $27 a bottle, structure-function claims only"), status("tam_sam")),
      finish,
    ],
    offers: [
      turn(use, fact("offers", "price_ladder", "Mullevia $26.95 | Betterbrand $39"), fact("offers", "subscription_terms", "15% off | none"), fact("offers", "guarantees", "60 days | 30 days"),
        fact("offers", "funnel_shapes", "advertorial | direct to product"), fact("offers", "dominant_pattern", "single bottle with a subscribe discount"),
        item("record_gap", { node: "offers", missing: "trials_and_bundles: no competitor page shows a trial" }), status("offers")),
      finish,
    ],
    sophistication: [turn(use, item("record_ad_elements", { brand: "Betterbrand", source_id: "sha256:aaa", elements: ["claim", "amplifier", "mechanism"] }), fact("sophistication", "stage", "3 — every brand tagged explains how it works"), fact("sophistication", "claims_running", "clears mucus (6)"), fact("sophistication", "escalation", "from clear to deep detox in 18 months"), status("sophistication")), finish],
    breaking_point: [turn(use, fact("breaking_point", "moments", "a cough that kept them up the night before a big day"), item("record_buyer_stage", { source_id: "sha256:aaa", who: "Amazon reviewer, 2 stars", stage: "skeptic" }), status("breaking_point")), finish],
    gate: [
      turn(use, ...["size", "margin", "mechanism_availability", "claim_room"].map((key) => fact("viability", key, key === "margin" ? "unknown — no landed cost entered" : "pass — see the market rows")),
        fact("viability", "structural_churn", "fail — the bottle runs out before the carrier works"), fact("viability", "verdict", "reposition — fix the refill interval first"), status("viability")),
      finish,
    ],
  };
}

const REWRITES = turn(fauxToolCall("record_rewrites", {
  rewrites: [
    { key: "size", text: "pass — the part of the market this product can reach is big enough" },
    { key: "structural_churn", text: "pass — a changed first word is refused" },
  ],
  verdict: { stands: "Reposition: churn fails.", change: "a longer-lasting bottle", from_you: "your landed unit cost", would_change: "" },
} as Parameters<typeof fauxToolCall>[1]));

function routeByAgent(script: Record<MarketTruthAgent, AssistantMessage[]>, spoke: string[], rewrites: AssistantMessage[] = []): void {
  const queues = Object.fromEntries(Object.entries({ ...script, reword: rewrites }).map(([id, turns]) => [id, [...turns]]));
  const total = Object.values(script).reduce((n, turns) => n + turns.length, 0);
  faux.setResponses(Array.from({ length: total + 8 }, () => (context: { messages: unknown[] }) => {
    const text = JSON.stringify(context.messages);
    const agent = text.includes("record_rewrites") ? "reword" : (/You are the `(\w+)` agent/.exec(text)?.[1] ?? "");
    if (!spoke.includes(agent)) spoke.push(agent);
    return queues[agent]?.shift() ?? fauxAssistantMessage("nothing scripted");
  }));
}

describe("a market-truth run", () => {
  it("refuses without product truth: the gate needs it", async () => {
    await seed(1, minimalPacket({ brief: BRIEF }));
    const created = await post("/api/research/runs", { brief: BRIEF, nodes: ["tam_sam"] });
    expect(created.status).toBe(409);
    expect(await created.text()).toContain("market truth reads a completed product-truth run");
  });

  it("runs the four gatherers, then the gate, citing stage 1's source by id, and settles one stage-4 packet with the verdict", async () => {
    const stageOne = await seed(1, minimalPacket({ brief: BRIEF }));
    await seed(2, TRUTH);
    const spoke: string[] = [];
    routeByAgent(scripts(), spoke);
    const created = await post("/api/research/runs", { brief: BRIEF, nodes: ["tam_sam"] });
    expect(created.status).toBe(200);
    const { id, stage, nodes } = (await created.json()) as { id: string; stage: number; nodes: string[] };
    expect([stage, nodes]).toEqual([4, ["tam_sam", "offers", "sophistication", "breaking_point", "viability"]]);
    await app.supervisor.live.get(id)?.done;
    const run = (await store.getRun(id))!;
    expect([run.status, run.error, run.source_run_id]).toEqual(["completed", "", stageOne]);
    expect(spoke.filter((agent) => agent !== "reword").at(-1)).toBe("gate");
    expect((await store.findings.list(id)).filter((r) => r.retracted_at)).toEqual([]);
    const packet = stagePacketSchema.parse(run.packet);
    expect(packet.stage).toBe(4);
    expect(packet.sources.map((s) => s.id)).toEqual(["sha256:aaa"]);
    expect(packet.measurements.map((m) => [m.metric, m.value])).toEqual([["tam", 1200], ["sam", 40]]);
    expect(packet.attributes.find((a) => a.key === "verdict")?.value).toBe("reposition — fix the refill interval first");
    expect(packet.nodes.map((n) => [n.node, n.status]).sort()).toEqual(nodes.map((node) => [node, "complete"]).sort());
    expect(packet.attributes.every((a) => a.source_id === "sha256:aaa")).toBe(true);
    expect(packet.element_shares.map((e) => [e.element, e.brands, e.of])).toEqual([["claim", 1, 1], ["amplifier", 1, 1], ["mechanism", 1, 1], ["proof", 0, 1], ["identity", 0, 1]]);
    expect(packet.buyer_stage_shares.filter((b) => b.voices > 0)).toEqual([{ stage: "skeptic", voices: 1, of: 1 }]);
    const prompts = (await store.listLlmCalls(id)).map((c) => c.system_prompt ?? "").join("\n");
    expect(prompts).toContain("This is market truth");
  });

  it("has the judge model rewrite the gate to read on its own, keeping a rewrite only where the verdict word stays", async () => {
    await seed(1, minimalPacket({ brief: BRIEF }));
    await seed(2, TRUTH);
    routeByAgent(scripts(), [], [REWRITES]);
    const { id } = (await (await post("/api/research/runs", { brief: BRIEF, nodes: ["tam_sam"] })).json()) as { id: string };
    await app.supervisor.live.get(id)?.done;
    const gate = stagePacketSchema.parse((await store.getRun(id))!.packet).attributes.filter((a) => a.node === "viability");
    expect(gate.find((a) => a.key === "size")).toMatchObject({ value: "pass — see the market rows", reads_as: "pass — the part of the market this product can reach is big enough" });
    expect(gate.find((a) => a.key === "structural_churn")?.reads_as).toBeUndefined();
    expect(gate.find((a) => a.key === "verdict")?.sections).toEqual([
      { title: "Where it stands", text: "Reposition: churn fails." },
      { title: "What has to change", text: "a longer-lasting bottle" },
      { title: "What we need from you", text: "your landed unit cost" },
    ]);
    expect((await store.listEvents(id)).find((e) => e.kind === "packet.reworded")?.payload).toEqual({ kept: 2 });
  });

  it("rewrites an earlier run's gate on request", async () => {
    await seed(1, minimalPacket({ brief: BRIEF }));
    await seed(2, TRUTH);
    routeByAgent(scripts(), []);
    const { id } = (await (await post("/api/research/runs", { brief: BRIEF, nodes: ["tam_sam"] })).json()) as { id: string };
    await app.supervisor.live.get(id)?.done;
    expect(stagePacketSchema.parse((await store.getRun(id))!.packet).attributes.some((a) => a.reads_as)).toBe(false);
    routeByAgent(scripts(), [], [REWRITES]);
    const reworded = await post(`/api/research/runs/${id}/reword`, {});
    expect(await reworded.json()).toEqual({ reworded: 2 });
  });

  it("works the owner's saved landed cost into a margin, and hands it to the gate where product truth ran without one", async () => {
    await seed(1, minimalPacket({ brief: BRIEF }));
    const priced = { ...TRUTH, prices: [{ label: "one bottle", amount: 27, currency: "USD", units: 1, subscription: false, market: "", source_id: "sha256:aaa" }] };
    const truthId = await seed(2, priced);
    const productId = (await store.getRun(truthId))!.product_id;
    expect((await post(`/api/research/products/${productId}/costs`, { landed_unit_cost: 0, currency: "USD" })).status).toBe(400);
    const saved = (await (await post(`/api/research/products/${productId}/costs`, { landed_unit_cost: 6.75, currency: "usd" })).json()) as { costs: { currency: string }; margins: { margin: number }[] };
    expect([saved.costs.currency, saved.margins.map((m) => m.margin)]).toEqual(["USD", [0.75]]);
    const spoke: string[] = [];
    routeByAgent(scripts(), spoke);
    const { id } = (await (await post("/api/research/runs", { brief: BRIEF, nodes: ["tam_sam"] })).json()) as { id: string };
    await app.supervisor.live.get(id)?.done;
    const gatePrompt = (await store.listLlmCalls(id)).filter((c) => c.agent_id === "gate").map((c) => JSON.stringify(c.input)).join("");
    expect(gatePrompt).toContain("6.75");
  });
});

describe("a rewrite of a recorded value", () => {
  it("must cite exactly the sources the original cited", () => {
    const original = "fail — the doses are capped sha256:abcdef12 and the claim is taken (sha256:0123456789)";
    expect(RewordCheck.keeps(original, "fail — the doses cannot go higher sha256:abcdef12, and the claim is already used sha256:0123456789", { kind: "one_of", values: ["fail"] })).toBe(true);
    expect(RewordCheck.keeps(original, "fail — the doses cannot go higher sha256:abcdef12", { kind: "one_of", values: ["fail"] })).toBe(false);
    expect(RewordCheck.keeps(original, "fail — new sha256:abcdef12 sha256:0123456789 sha256:ffffff00", { kind: "one_of", values: ["fail"] })).toBe(false);
  });
});

describe("the gate's closed choices", () => {
  const row = (key: string, value: string, seq: number): Finding => ({ seq, id: `at${seq}`, created_at: "", retracted_at: "", retracted_why: "", run_id: "r", kind: "attribute", entity: "market", agent_id: "gate", source_id: "s", payload: { node: "viability", key, value, source_id: "s" } });
  const missing = (rows: Finding[]) => new FieldsCheck(GATE_DELIVERABLE).missing(rows).map((m) => m.key);
  const criteria = ["size", "margin", "mechanism_availability", "claim_room", "structural_churn"].map((key, i) => row(key, "pass — fine", i));

  it("holds a criterion or verdict open until it starts with an allowed word, whatever reason follows", () => {
    expect(missing([...criteria, row("verdict", "maybe — hard to say", 9)])).toEqual(["verdict"]);
    expect(missing([...criteria, row("verdict", "Reposition: fix the refill", 9)])).toEqual([]);
    expect(missing([row("size", "probably fine", 1), ...criteria.slice(1), row("verdict", "go", 9)])).toEqual(["size"]);
    expect(new FieldsCheck(GATE_DELIVERABLE).missing([...criteria, row("verdict", "maybe", 9)])[0]!.text).toContain('must start with one of "go", "reposition", "drop"');
  });
});

describe("the sophistication stage", () => {
  let seq = 0;
  const tag = (brand: string, ...elements: string[]): Finding => ({ seq: ++seq, id: `ae${seq}`, created_at: "", retracted_at: "", retracted_why: "", run_id: "r", kind: "ad_elements", entity: "", agent_id: "sophistication", source_id: `s${seq}`, payload: { brand, source_id: `s${seq}`, elements } });
  const stage = (value: string): Finding => ({ seq: ++seq, id: `at${seq}`, created_at: "", retracted_at: "", retracted_why: "", run_id: "r", kind: "attribute", entity: "", agent_id: "sophistication", source_id: "s", payload: { node: "sophistication", key: "stage", value, source_id: "s" } });
  const market = [tag("A", "claim", "proof"), tag("a", "mechanism"), tag("B", "claim", "proof", "identity"), tag("C", "claim", "amplifier"), tag("D", "claim")];

  it("is the most advanced element at least half the brands use, a brand's ads counted together", () => {
    expect(SophisticationStage.shares(market).map((s) => [s.element, s.brands, s.of])).toEqual([["claim", 4, 4], ["amplifier", 1, 4], ["mechanism", 1, 4], ["proof", 2, 4], ["identity", 1, 4]]);
    expect(SophisticationStage.of(market)).toBe(4);
    expect(SophisticationStage.of([tag("E", "claim")])).toBe(1);
    expect(SophisticationStage.of([])).toBeNull();
  });

  it("holds the agent's stage open until it matches the count, and says what the count shows", () => {
    const check = new FieldsCheck(SOPHISTICATION_DELIVERABLE);
    const rest = [stage("x"), { ...stage("x"), payload: { node: "sophistication", key: "claims_running", value: "clears mucus (6)" } }, { ...stage("x"), payload: { node: "sophistication", key: "escalation", value: "18 months" } }].slice(1);
    const wrong = check.missing([...market, ...rest, stage("3 — mechanisms everywhere")]);
    expect(wrong.map((m) => m.key)).toEqual(["stage"]);
    expect(wrong[0]!.text).toContain("must start with 4: the ads you tagged show claim on 4 of 4 brands");
    expect(check.missing([...market, ...rest, stage("4 — proof on half the brands")])).toEqual([]);
    expect(check.missing([...rest, stage("4")]).map((m) => m.key)).toEqual(["ad_elements", "stage"]);
  });
});

describe("the buyer stages", () => {
  let seq = 0;
  const voice = (who: string, stage: string, source = "s1"): Finding => ({ seq: ++seq, id: `bs${seq}`, created_at: "", retracted_at: "", retracted_why: "", run_id: "r", kind: "buyer_stage", entity: "", agent_id: "breaking_point", source_id: source, payload: { source_id: source, who, stage } });

  it("counts each voice once, the newest tag of a voice standing", () => {
    const rows = [voice("reviewer A", "explorer"), voice("reviewer A", "skeptic"), voice("reviewer B", "hopeless"), voice("reviewer A", "skeptic", "s2")];
    expect(BuyerStages.shares(rows).map((s) => [s.stage, s.voices, s.of])).toEqual([["beginner", 0, 3], ["explorer", 0, 3], ["researcher", 0, 3], ["skeptic", 2, 3], ["hopeless", 1, 3]]);
  });
});
