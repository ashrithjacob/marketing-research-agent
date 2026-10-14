/**
 * The durable research task, end to end on a real harness file and pi's faux model:
 * a contract run to completion, nudged when the model stops early, stopped by a
 * breaker, refused before it starts, and resumed after the harness closes mid-task.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type AssistantMessage, type MutableModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, type FauxResponseStep } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OpenRouterPrices, type SqlResearchStore } from "../src/adapters/index.js";
import { LiveRuns, PiHarness, RunError, RunSupervisor, TaskEvents, TaskSupervisor, ToolRegistry } from "../src/agent/index.js";
import { App } from "../src/http/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { PRODUCT_DELIVERABLE, TERMINAL_STATUSES } from "../src/domain/index.js";
import { productPacket, recordCalls, services } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

const MODEL_ID = "faux-model";
const BRIEF = { product: "", url: "https://magnacalm.example", market: "UK", notes: "" };
const CONTRACT = {
  objective: "MagnaCalm's own fact sheet, from its product page",
  primitive: "research",
  complete: PRODUCT_DELIVERABLE,
  budget: { max_usd: 1, max_minutes: 30 },
};

let dir: string;
let store: SqlResearchStore;
let settings: Settings;
let models: MutableModels;
let faux: ReturnType<typeof fauxProvider>;
let harness: PiHarness;
let tasks: TaskSupervisor;

async function open(): Promise<void> {
  harness = await PiHarness.open(join(dir, "harness.sqlite"), models);
  const costs = new OpenRouterPrices({ apiKey: "" });
  tasks = new TaskSupervisor({ store, runs: new LiveRuns(store), settings, harness, tools: new ToolRegistry(services(settings), settings), costs, events: new TaskEvents() });
  await tasks.recover();
  harness.resume();
}

async function settled(runId: string): Promise<string> {
  for (let i = 0; i < 400; i++) {
    const status = (await store.getRun(runId))?.status ?? "";
    if (TERMINAL_STATUSES.has(status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`run ${runId} never ended: ${(await store.getRun(runId))?.status}`);
}

const recordAll = (): AssistantMessage => fauxAssistantMessage(recordCalls(productPacket({ excerpts: [] })), { stopReason: "toolUse" });
const finish = (): AssistantMessage => fauxAssistantMessage(fauxToolCall("finish", {}), { stopReason: "toolUse" });
const sent = async (runId: string): Promise<string> => JSON.stringify((await store.listLlmCalls(runId)).map((call) => call.input));

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-task-"));
  store = await SqliteStores.open(join(dir, "research.db"));
  settings = { ...Env.settings(), model: MODEL_ID, corpusPath: join(dir, "corpus"), taskMaxUsd: 2 };
  faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  models = createModels();
  models.setProvider(faux.provider);
  await open();
});

afterEach(async () => {
  await harness.close();
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("a research task", () => {
  it("runs its contract to completion on the harness, and links its run to its task and conversation", async () => {
    faux.setResponses([recordAll(), finish()]);
    const run = await tasks.start({ brief: BRIEF, contract: CONTRACT }, "admin");
    expect(run).toMatchObject({ status: "queued", nodes: ["product_data"], contract: { primitive: "research" } });
    expect(await settled(run.id)).toBe("completed");
    const ended = (await store.getRun(run.id))!;
    expect(ended.task_id).not.toBe("");
    expect(ended.conversation_id).not.toBe("");
    expect((await store.listLlmCalls(run.id)).map((call) => call.agent_id)).toEqual(["research", "research"]);
    expect((await store.findings.list(run.id)).filter((row) => row.kind === "attribute")).toHaveLength(1);
    expect(new Set((await store.findings.list(run.id)).map((row) => row.agent_id))).toEqual(new Set(["research"]));
  });

  it("is told what is still missing when the model stops without finishing, and goes on", async () => {
    faux.setResponses([fauxAssistantMessage("I think that is everything."), recordAll(), finish()]);
    const run = await tasks.start({ brief: BRIEF, contract: CONTRACT }, "admin");
    expect(await settled(run.id)).toBe("completed");
    expect(await sent(run.id)).toContain("Still missing:");
  });

  it("ends partial, with each missing field gapped and why, when five responses in a row add nothing", async () => {
    const idle: FauxResponseStep = () => fauxAssistantMessage(fauxToolCall("read_ledger", {}), { stopReason: "toolUse" });
    faux.setResponses(Array.from({ length: 12 }, () => idle));
    const run = await tasks.start({ brief: BRIEF, contract: CONTRACT }, "admin");
    expect(await settled(run.id)).toBe("partial");
    const ended = (await store.getRun(run.id))!;
    expect(ended.error).toBe("stopped early: 5 responses in a row added nothing new");
    expect((ended.packet as any).gaps.map((g: any) => g.missing)).toContain("price: not found: 5 responses in a row added nothing new");
    expect((await store.listLlmCalls(run.id)).length).toBeLessThanOrEqual(6);
  });

  it("refuses a contract that cannot be met, and writes no run for it", async () => {
    const before = (await store.listRuns({ workspaceId: null } as never)).length;
    const impossible = { ...CONTRACT, budget: { max_usd: 50, max_minutes: 30 } };
    await expect(tasks.start({ brief: BRIEF, contract: impossible }, "admin")).rejects.toThrow(RunError);
    await expect(tasks.start({ brief: BRIEF, contract: impossible }, "admin")).rejects.toThrow(/over the per-task cap of 2/);
    expect((await store.listRuns({ workspaceId: null } as never)).length).toBe(before);
  });

  it("picks up where it stopped after the harness closes mid-task, its earlier findings intact", async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    let reached: () => void = () => {};
    const waiting = new Promise<void>((resolve) => (reached = resolve));
    const slow: FauxResponseStep = async () => {
      reached();
      await held;
      return finish();
    };
    faux.setResponses([recordAll(), slow, finish()]);
    const run = await tasks.start({ brief: BRIEF, contract: CONTRACT }, "admin");
    await waiting;
    const before = (await store.findings.list(run.id)).length;
    expect(before).toBeGreaterThan(0);
    const closing = harness.close();
    release();
    await closing;
    expect((await store.getRun(run.id))!.status).toBe("running");

    await open();
    expect(await settled(run.id)).toBe("completed");
    expect((await store.findings.list(run.id)).slice(0, before)).toHaveLength(before);
    expect((await store.getRun(run.id))!.packet).not.toBeNull();
  });

  it("is left to the harness by the startup recovery that ends today's interrupted stage runs", async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    faux.setResponses([async () => (await held, recordAll()), finish()]);
    const run = await tasks.start({ brief: BRIEF, contract: CONTRACT }, "admin");
    for (let i = 0; i < 100 && (await store.getRun(run.id))!.status !== "running"; i++) await new Promise((r) => setTimeout(r, 10));
    await new RunSupervisor({ store, settings, models }).recoverRunsKilledByRestart();
    expect((await store.getRun(run.id))!.status).toBe("running");
    release();
    expect(await settled(run.id)).toBe("completed");
  });
});

describe("POST /api/research/tasks", () => {
  const post = (app: App, body: unknown) =>
    app.fetch(new Request("http://mra.test/api/research/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

  it("answers 202 with the queued run, and 400 with the reasons for a refused contract", async () => {
    faux.setResponses([recordAll(), finish()]);
    const app = new App({ settings: { ...settings, appPasswordHash: "", staticDir: join(dir, "static") }, store, harness });
    const accepted = await post(app, { brief: BRIEF, contract: CONTRACT });
    expect(accepted.status).toBe(202);
    const body = (await accepted.json()) as { id: string; status: string };
    expect(body.status).toBe("queued");
    expect(await settled(body.id)).toBe("completed");
    const refused = await post(app, { brief: BRIEF, contract: { ...CONTRACT, verify: "owner" } });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { detail: string }).detail).toBe("task refused: verify 'owner' has nothing to run it yet; only 'code' is built");
  });
});
