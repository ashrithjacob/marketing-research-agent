/**
 * Start, review, chat (spec §11, part 3), through the HTTP routes on a real harness file,
 * with pi's faux model playing both the operator and the worker.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type AssistantMessage, type MutableModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SqlResearchStore } from "../src/adapters/index.js";
import { PiHarness } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { TERMINAL_STATUSES, type ChatMessage, type Plan } from "../src/domain/index.js";
import { App } from "../src/http/index.js";
import { productPacket, recordCalls } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

const MODEL_ID = "faux-model";
const BRIEF = { url: "https://magnacalm.example" };

let dir: string;
let store: SqlResearchStore;
let settings: Settings;
let models: MutableModels;
let faux: ReturnType<typeof fauxProvider>;
let harness: PiHarness;
let app: App;

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

async function chat(): Promise<ChatMessage[]> {
  let seen: ChatMessage[] = [];
  const stop = await app.workspace!.operator.watch("admin", (lines) => (seen = lines));
  stop();
  return seen;
}

const recordAll = (): AssistantMessage => fauxAssistantMessage(recordCalls(productPacket({ excerpts: [] })), { stopReason: "toolUse" });
const finish = (): AssistantMessage => fauxAssistantMessage(fauxToolCall("finish", {}), { stopReason: "toolUse" });

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-operator-"));
  store = await SqliteStores.open(join(dir, "research.db"));
  settings = { ...Env.settings(), model: MODEL_ID, corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "", taskMaxUsd: 2 };
  faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  models = createModels();
  models.setProvider(faux.provider);
  harness = await PiHarness.open(join(dir, "harness.sqlite"), models);
  app = new App({ settings, store, harness });
  await app.workspace!.tasks.recover();
  harness.resume();
});

afterEach(async () => {
  await harness.close();
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("start, review, chat", () => {
  it("proposes a plan that runs nothing, changes it by chat and toggles, and starts only what the owner approves", async () => {
    const started = await call("POST", "/plans", { brief: BRIEF });
    expect(started.status).toBe(201);
    const plan = (await started.json()) as Plan;
    expect(plan).toMatchObject({ status: "draft", tasks: [{ key: "product_facts", selected: true }, { key: "category_numbers", selected: true }] });
    expect((await store.listRuns({ workspaceId: null } as never)).length).toBe(0);

    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("revise_plan", { plan_id: plan.id, drop: ["category_numbers"], market: "UK" }), { stopReason: "toolUse" }),
      fauxAssistantMessage("Done: only the product facts, for the UK. Approve it when you are ready."),
    ]);
    expect((await call("POST", "/chat", { text: "Skip the category numbers, UK only", plan_id: plan.id })).status).toBe(202);
    const lines = await until(chat, (seen) => seen.some((line) => line.role === "operator" && !line.partial));
    expect(lines.map((line) => line.role)).toEqual(["note", "owner", "action", "operator"]);
    expect(lines[2]!.text).toContain("revise_plan");
    const revised = (await (await call("GET", `/plans/${plan.id}`)).json()) as Plan;
    expect(revised.brief.market).toBe("UK");
    expect(revised.tasks.map((t) => [t.key, t.selected])).toEqual([["product_facts", true], ["category_numbers", false]]);

    const toggled = (await (await call("POST", `/plans/${plan.id}/tasks/category_numbers`, { selected: false })).json()) as Plan;
    expect(toggled.tasks[1]!.selected).toBe(false);

    faux.setResponses([recordAll(), finish()]);
    const approved = await call("POST", `/plans/${plan.id}/approve`);
    expect(approved.status).toBe(202);
    const body = (await approved.json()) as Plan;
    expect(body.status).toBe("approved");
    const runId = body.tasks[0]!.run_id;
    expect(runId).not.toBe("");
    expect(body.tasks[1]!.run_id).toBe("");
    const ended = await until(() => store.getRun(runId), (run) => !!run && TERMINAL_STATUSES.has(run.status));
    expect(ended!.status).toBe("completed");
    expect(ended!.brief).toMatchObject({ market: "UK" });
    const notes = await until(chat, (seen) => seen.some((line) => line.text.includes(`Task ${runId} ended completed`)));
    expect(notes.filter((line) => line.role === "note").map((line) => line.text.split(":")[0])).toEqual([
      `The owner started plan ${plan.id} for https`,
      `The owner approved plan ${plan.id}. Started`,
      `Task ${runId} ended completed`,
    ]);
    expect((await call("POST", `/plans/${plan.id}/approve`)).status).toBe(400);
  });

  it("streams the chat and the board, a snapshot first", async () => {
    await call("POST", "/plans", { brief: BRIEF });
    const response = await call("GET", "/workspace/stream");
    const reader = response.body!.getReader();
    let text = "";
    while (!(text.includes("event: chat") && text.includes("event: board"))) text += new TextDecoder().decode((await reader.read()).value);
    await reader.cancel();
    const board = JSON.parse(text.split("event: board\ndata: ")[1]!.split("\n")[0]!);
    expect(board.plans[0]).toMatchObject({ status: "draft" });
    expect(board.tasks).toEqual([]);
  });
});
