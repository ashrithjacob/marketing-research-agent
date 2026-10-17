/**
 * A whole customer-truth run with scripted agents (decided 2026-10-16, docs/spec-customer-truth.md):
 * voices and identity side by side from the mined reviews, then avatars, then awareness, every
 * quote copied by code from a review ref, never typed. The faux model answers each agent from its
 * own script, picked by the agent name in its system prompt.
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
import { CHANNELS, avatarSchema, productTruthPacketSchema, stagePacketSchema, type CustomerTruthAgent, type Finding } from "../src/domain/index.js";
import { CustomerTruthCheck } from "../src/extract/index.js";
import { App } from "../src/http/index.js";

import { minimalPacket } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

let dir: string;
let store: SqlResearchStore;
let app: App;
let faux: ReturnType<typeof fauxProvider>;

const BRIEF = { product: "", url: "https://mullevia.com/products/mullevia-mullein-drops", market: "US", notes: "" };

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-customer-"));
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

const NODES: Record<number, string[]> = { 1: ["product_data"], 2: ["mechanism"], 3: ["review_mining"], 4: ["tam_sam", "offers", "sophistication", "breaking_point", "viability"] };

async function seed(stage: number, packet: Record<string, unknown>): Promise<string> {
  const run = await store.createRun({ workspaceId: "admin", brief: BRIEF, model: "m", rejectKinds: [], judgementIds: [], nodes: NODES[stage] as never, stage });
  await store.updateRun(run.id, { status: "completed", packet });
  return run.id;
}

const TRUTH = productTruthPacketSchema.parse({
  contract_version: "1", stage: 2, run_id: "", source_run_id: "", brief: BRIEF, guard: "not legal advice", sources: [], actives: [], regimen: null, mechanisms: [], doses: [], claim_limits: [], prices: [],
  economics: { operator: null, days_of_supply: 30, days_why: "30 servings at one a day", churn: { mismatch: null, why: "no carrier timing", carriers: [] }, margins: [] }, nodes: [], gaps: [],
});

const market = (verdict: string) => stagePacketSchema.parse({ stage: 4, brief: BRIEF, attributes: [{ id: "at1", node: "viability", key: "verdict", value: `${verdict} — fix the claims`, source_id: "sha256:aaa" }] });

const REVIEWS = ["Coughed every night for a year, nothing helped", "I just want to sleep through without hacking", "Tried three brands, all useless — show me a study"];

async function seedVoice(): Promise<void> {
  const id = await seed(3, minimalPacket({ brief: BRIEF }));
  const pull = { handle: "p1", source_id: "sha256:rev", target_id: "product", platform: "amazon" as const, listing: "https://www.amazon.com/dp/B1", band_requested: 2, fetched_at: "2026-10-01T00:00:00Z", archived: true, total_reviews: null, total_ratings: null, gap: null };
  const reviews = REVIEWS.map((text, i) => ({ ref: `r1.${i + 1}`, pull: "p1", platform: "amazon" as const, review_key: `R${i}`, listing: "https://www.amazon.com/dp/B1", star: i + 1, title: "", text, posted_at: "2026-09-01", verified: true, locator: "" }));
  await store.saveRunReviews(id, { pulls: [pull], reviews });
}

const call = (name: string, args: Record<string, unknown>) => fauxToolCall(name, args as Parameters<typeof fauxToolCall>[1]);
const item = (name: string, payload: Record<string, unknown>) => call(name, { item: payload });
const turn = (...calls: ReturnType<typeof fauxToolCall>[]) => fauxAssistantMessage(calls, { stopReason: "toolUse" });
const status = (node: string) => item("record_node_status", { node, status: "complete", done_criterion_met: true, why: "done" });
const finish = turn(call("finish", {}));
const avatar = (id: string, quoteIds: string[]) => ({ id, parent: null, name: id, proxy: false, situation: "s", history: "tried things", demographics: "40s", pains: ["cough"], outcomes: ["sleep"], objections: ["another dud"], identity: "the cougher", secondary_gain: "an excuse", blame: "inward", quote_ids: quoteIds, provenance: "evidenced" });
const aware = (avatarId: string, channel: string) => item("record_awareness", { avatar_id: avatarId, channel, weights: { unaware: 0, problem_aware: 0.7, solution_aware: 0.3, product_aware: 0, most_aware: 0 }, entry: "problem_aware", why: "they name the cough", quote_ids: [], provenance: "inferred" });

function scripts(): Record<CustomerTruthAgent, AssistantMessage[]> {
  return {
    voices: [
      turn(call("read_reviews", {})),
      turn(...["pain", "outcome", "proof"].map((fn, i) => call("record_quote", { review_ref: `r1.${[1, 2, 3][i]}`, function: fn })), call("record_quote", { review_ref: "r1.3", function: "objection", buyer_stage: "skeptic" }), status("language_bank")),
      finish,
    ],
    identity: [
      turn(call("record_quote", { review_ref: "r1.1", function: "pain" }), call("record_quote", { review_ref: "r9.9", function: "pain" })),
      turn(...["label_self", "guilt", "loss", "feared_identity"].map((kind) => item("record_identity_entry", { kind, summary: kind, quote_ids: [], provenance: "inferred" })),
        item("record_pain_profile", { pain: "night cough", emotion: "helplessness", intensity: "high", duration: "chronic", social: "relationship", quote_ids: [], provenance: "inferred" }), status("identity")),
      finish,
    ],
    avatars: [
      turn(item("record_avatar", avatar("night_cougher", ["qt999"]))),
      turn(item("record_avatar", { ...avatar("night_cougher", []), provenance: "inferred" }), item("record_avatar", { ...avatar("burned_buyer", []), provenance: "inferred" }), item("record_attribute", { node: "avatars", key: "proxy_buying", value: "none — no review buys for someone else", source_id: "sha256:rev" }), status("avatars")),
      finish,
    ],
    awareness: [turn(...["night_cougher", "burned_buyer"].flatMap((a) => CHANNELS.map((ch) => aware(a, ch))), status("awareness")), finish],
  };
}

function routeByAgent(script: Record<CustomerTruthAgent, AssistantMessage[]>, said: Record<string, string[]>): void {
  const queues = Object.fromEntries(Object.entries(script).map(([id, turns]) => [id, [...turns]]));
  faux.setResponses(Array.from({ length: 40 }, () => (context: { messages: unknown[] }) => {
    const text = JSON.stringify(context.messages);
    const agent = /You are the `(\w+)` agent/.exec(text)?.[1] ?? "";
    (said[agent] ??= []).push(text);
    return queues[agent]?.shift() ?? fauxAssistantMessage("nothing scripted");
  }));
}

describe("a customer-truth run", () => {
  it("is refused without customer voice, and on a drop verdict", async () => {
    await seed(1, minimalPacket({ brief: BRIEF }));
    await seed(2, TRUTH);
    await seed(4, market("reposition"));
    const noVoice = await post("/api/research/runs", { brief: BRIEF, nodes: ["avatars"] });
    expect(noVoice.status).toBe(409);
    expect(await noVoice.text()).toContain("offer customer voice first");
    await seedVoice();
    await seed(4, market("drop"));
    const dropped = await post("/api/research/runs", { brief: BRIEF, nodes: ["avatars"] });
    expect(dropped.status).toBe(409);
    expect(await dropped.text()).toContain("verdict is drop");
  });

  it("copies every quote from its review, refuses an unknown ref or quote id, and settles one stage-5 packet", async () => {
    await seed(1, minimalPacket({ brief: BRIEF }));
    await seed(2, TRUTH);
    await seedVoice();
    await seed(4, market("reposition"));
    const said: Record<string, string[]> = {};
    routeByAgent(scripts(), said);
    const created = await post("/api/research/runs", { brief: BRIEF, nodes: ["avatars"] });
    expect(created.status).toBe(200);
    const { id, stage, nodes } = (await created.json()) as { id: string; stage: number; nodes: string[] };
    expect([stage, nodes]).toEqual([5, ["language_bank", "identity", "avatars", "awareness"]]);
    await app.supervisor.live.get(id)?.done;
    const run = (await store.getRun(id))!;
    expect([run.status, run.error]).toEqual(["completed", ""]);
    const packet = stagePacketSchema.parse(run.packet);
    expect(packet.stage).toBe(5);
    expect(packet.quotes.map((q) => [q.review_ref, q.text, q.function])).toContainEqual(["r1.3", REVIEWS[2], "objection"]);
    expect(packet.quotes.every((q) => REVIEWS.includes(q.text))).toBe(true);
    expect(packet.avatars.map((a) => a.id).sort()).toEqual(["burned_buyer", "night_cougher"]);
    expect(packet.awareness).toHaveLength(2 * CHANNELS.length);
    expect(said.voices!.join("")).toContain("Coughed every night for a year");
    expect(said.identity!.join("")).toContain("no review with ref 'r9.9'");
    expect(said.avatars!.join("")).toContain("no quote with id qt999 in the ledger");
    expect(said.avatars![0]).toContain(REVIEWS[2]!.slice(0, 20));
  });
});

describe("customer truth's rules across rows", () => {
  let seq = 0;
  const row = (kind: string, payload: Record<string, unknown>): Finding => ({ seq: ++seq, id: `x${seq}`, created_at: "", retracted_at: "", retracted_why: "", run_id: "r", kind: kind as Finding["kind"], entity: "", agent_id: "a", source_id: "", payload });

  it("wants two to four top-level avatars, sub-avatars not counted", () => {
    const one = [row("avatar", { id: "a", parent: null }), row("avatar", { id: "a1", parent: "a" })];
    expect(CustomerTruthCheck.avatars(one)[0]!.text).toContain("1 top-level avatars recorded (a)");
    expect(CustomerTruthCheck.avatars([...one, row("avatar", { id: "b", parent: null })])).toEqual([]);
  });

  it("wants awareness for every top-level avatar on every channel", () => {
    const rows = [row("avatar", { id: "a", parent: null }), ...CHANNELS.slice(1).map((channel) => row("awareness", { avatar_id: "a", channel }))];
    expect(CustomerTruthCheck.awareness(rows)[0]!.text).toBe("no awareness recorded for a on cold_social");
  });

  it("refuses an evidenced row that cites no voice", () => {
    const base = { id: "a", name: "A", proxy: false, situation: "s", history: "h", demographics: "d", pains: ["p"], outcomes: ["o"], identity: "i", secondary_gain: "g", blame: "inward" };
    expect(avatarSchema.safeParse({ ...base, provenance: "evidenced" }).success).toBe(false);
    expect(avatarSchema.safeParse({ ...base, provenance: "inferred" }).success).toBe(true);
  });
});
