/**
 * Always on (spec §7.2–7.4, part 7), on a real harness file with pi's faux model as the
 * operator and the worker: work nobody clicked, started inside its limits.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type AssistantMessage, type MutableModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, type FauxResponseStep } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SqlResearchStore } from "../src/adapters/index.js";
import { MoneyGate, PiHarness } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { Scope, TERMINAL_STATUSES } from "../src/domain/index.js";
import { App } from "../src/http/index.js";
import { productPacket, recordCalls } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

const MODEL_ID = "faux-model";
const BRIEF = { url: "https://magnacalm.example", market: "UK" };
let dir: string;
let store: SqlResearchStore;
let settings: Settings;
let models: MutableModels;
let faux: ReturnType<typeof fauxProvider>;
let harness: PiHarness;
let app: App;
const said: string[] = [];

const call = (method: string, path: string, body?: unknown) =>
  app.fetch(new Request(`http://mra.test/api/research${path}`, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
async function until<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  for (let i = 0; i < 400; i++) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out");
}
const text = (content: unknown) => (typeof content === "string" ? content : JSON.stringify(content));
const recordAll = (): AssistantMessage => fauxAssistantMessage(recordCalls(productPacket({ excerpts: [] })), { stopReason: "toolUse" });
const finish = (): AssistantMessage => fauxAssistantMessage(fauxToolCall("finish", {}), { stopReason: "toolUse" });
const createTask = (): AssistantMessage => fauxAssistantMessage(fauxToolCall("create_task", { task_key: "product_facts", brief: BRIEF }), { stopReason: "toolUse" });
const tasks = async () => (await store.listRuns(Scope.of("admin"), 50)).filter((run) => run.contract);

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-always-"));
  store = await SqliteStores.open(join(dir, "research.db"));
  settings = { ...Env.settings(), model: MODEL_ID, judgeModel: "not-a-model", corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "", taskMaxUsd: 2 };
  faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  models = createModels();
  models.setProvider(faux.provider);
  harness = await PiHarness.open(join(dir, "harness.sqlite"), models);
  app = new App({ settings, store, harness });
  await app.workspace!.tasks.recover();
  harness.resume();
  said.length = 0;
  const route: FauxResponseStep = (context) => {
    const last = context.messages[context.messages.length - 1]!;
    const first = text(context.messages.find((m) => m.role === "user")?.content ?? "");
    if (last.role === "toolResult") {
      said.push(text(last.content));
      return first.includes("Your task: the product's fact sheet") ? finish() : fauxAssistantMessage("Done.");
    }
    if (first.includes("Your task: the product's fact sheet")) return recordAll();
    const now = text(last.content);
    said.push(now);
    if (now.includes("[Signal] Task")) return fauxAssistantMessage("Noted.");
    return createTask();
  };
  faux.setResponses(Array.from({ length: 80 }, () => route));
});

afterEach(async () => {
  await harness.close();
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("Always on", () => {
  it("needs a daily cap to switch on", async () => {
    expect((await call("POST", "/always-on", { on: true })).status).toBe(400);
    const on = await call("POST", "/always-on", { on: true, daily_cap_usd: 5 });
    expect(await on.json()).toMatchObject({ on: true, daily_cap_usd: 5, running: 0 });
    expect(await (await call("POST", "/always-on", { on: false })).json()).toMatchObject({ on: false });
  });

  it("lets the operator only draft a plan while off, and start a task while on", async () => {
    await call("POST", "/chat", { text: "Get the product facts for magnacalm." });
    await until(async () => said.length, (n) => n >= 2);
    expect(said.find((s) => s.includes("Drafted plan"))).toContain("because Always on is off");
    expect(await tasks()).toEqual([]);

    await call("POST", "/always-on", { on: true, daily_cap_usd: 5 });
    await call("POST", "/chat", { text: "Now get them." });
    const started = await until(tasks, (runs) => runs.length === 1);
    expect((await until(() => store.getRun(started[0]!.id), (r) => !!r && TERMINAL_STATUSES.has(r.status)))!.status).toBe("completed");
  });

  it("drafts instead of starting when three tasks run or today's spend reached the cap", async () => {
    await call("POST", "/always-on", { on: true, daily_cap_usd: 0.01 });
    const limits = app.workspace!.tasks.limits;
    const run = await store.createRun({ workspaceId: "admin", brief: BRIEF, model: "m", rejectKinds: [], judgementIds: [], contract: { objective: "x" } });
    await store.charges.add({ run_id: run.id, agent_id: null, service: "parallel", item: "search", units: 1, usd: 0.02, basis: "listed" } as never);
    expect(await limits.blocks("admin")).toEqual(["today's spend, $0.02, has reached the daily cap of $0.01"]);
    await call("POST", "/always-on", { on: true, daily_cap_usd: 10 });
    for (let i = 0; i < 3; i++) await store.updateRun((await store.createRun({ workspaceId: "admin", brief: BRIEF, model: "m", rejectKinds: [], judgementIds: [], contract: { objective: "x" } })).id, { status: "running" });
    expect((await limits.blocks("admin"))[0]).toMatch(/tasks are already running; at most 3/);
  });

  it("wakes the operator when a schedule comes due, and the work starts with nobody clicking", async () => {
    await call("POST", "/always-on", { on: true, daily_cap_usd: 5 });
    const schedule = (await (await call("POST", "/schedules", { task_key: "product_facts", every_days: 1, brief: BRIEF })).json()) as { id: string };
    await store.schedules.signalled(schedule.id, new Date(Date.now() - 3 * 86_400_000).toISOString());
    await call("POST", "/always-on", { on: false });
    await call("POST", "/always-on", { on: true, daily_cap_usd: 5 });
    const started = await until(tasks, (runs) => runs.length === 1);
    expect(said.some((s) => s.startsWith("[Signal] Scheduled: product_facts for https://magnacalm.example is due"))).toBe(true);
    await until(() => store.getRun(started[0]!.id), (r) => !!r && TERMINAL_STATUSES.has(r.status));
    await until(async () => said.filter((s) => s.startsWith("[Signal] Task")).length, (n) => n === 1);
    expect((await store.schedules.list("admin"))[0]!.last_due_at.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
  });

  it("collapses a repeated signal into one", async () => {
    await call("POST", "/always-on", { on: true, daily_cap_usd: 5 });
    for (let i = 0; i < 2; i++) await app.workspace!.operator.signal("admin", "", "Task r1 ended completed.", "task:r1:ended");
    await until(async () => said.filter((s) => s.includes("Task r1 ended")).length, (n) => n >= 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(said.filter((s) => s.includes("Task r1 ended")).length).toBe(1);
  });
});

describe("the money gate", () => {
  it("blocks Apify unless the owner approved the task, and any paid call past the cap", () => {
    expect(MoneyGate.block("amazon_find_product", false, null)).toMatch(/has not approved this task/);
    expect(MoneyGate.block("amazon_find_product", true, null)).toBeNull();
    expect(MoneyGate.block("web_fetch", true, "the cap is reached")).toMatch(/blocked until tomorrow/);
    expect(MoneyGate.block("record_attribute", false, "the cap is reached")).toBeNull();
  });
});
