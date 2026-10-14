/**
 * Start, review, chat (spec §11, part 3), through the HTTP routes on a real harness file,
 * with pi's faux model playing both the operator and the worker.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type AssistantMessage, type MutableModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, type FauxResponseStep } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SqlResearchStore } from "../src/adapters/index.js";
import { PiHarness } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { Scope, TERMINAL_STATUSES, type ChatMessage, type Plan } from "../src/domain/index.js";
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
  settings = { ...Env.settings(), model: MODEL_ID, judgeModel: "not-a-model", corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "", taskMaxUsd: 2 };
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
    expect(lines.map((line) => [line.role, line.text])).toEqual([
      ["owner", "Skip the category numbers, UK only"],
      ["operator", "Done: only the product facts, for the UK. Approve it when you are ready."],
    ]);
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
    expect((await chat()).map((line) => line.role)).toEqual(["owner", "operator"]);
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

describe("a task that stops and asks", () => {
  it("puts its question on a card, and the owner's reply in the chat reaches it through the operator and closes the card", async () => {
    await harness.close();
    harness = await PiHarness.open(join(dir, "harness-2.sqlite"), models);
    app = new App({ settings: { ...settings, judgeModel: MODEL_ID }, store, harness });
    await app.workspace!.tasks.recover();
    harness.resume();
    const text = (content: unknown) => (typeof content === "string" ? content : JSON.stringify(content));
    let runId = "";
    const route: FauxResponseStep = (context) => {
      const last = text(context.messages[context.messages.length - 1]!.content);
      if (last.startsWith("Condition:")) {
        return fauxAssistantMessage(last.includes("nothing yet") ? '{"stop": true, "question": "Drops or the diffuser?"}' : '{"stop": false, "question": ""}');
      }
      if (last.includes("is waiting for the owner's answer")) return fauxAssistantMessage(fauxToolCall("answer_task", { run_id: runId, answer: "The drops." }), { stopReason: "toolUse" });
      if (last.includes("Passed the answer")) return fauxAssistantMessage("Passed on.");
      if (last.includes("The owner answered your question")) return finish();
      return context.messages.some((m) => m.role === "toolResult") ? finish() : recordAll();
    };
    faux.setResponses(Array.from({ length: 30 }, () => route));
    const plan = (await (await call("POST", "/plans", { brief: BRIEF })).json()) as Plan;
    expect(plan.tasks[0]!.contract.stop_when).toContain("more than one product");
    await call("POST", `/plans/${plan.id}/tasks/category_numbers`, { selected: false });
    runId = ((await (await call("POST", `/plans/${plan.id}/approve`)).json()) as Plan).tasks[0]!.run_id;
    await until(() => store.getRun(runId), (run) => run?.status === "waiting");
    const board = (await until(() => app.workspace!.board.snapshot("admin"), (b) => b.tasks.some((t) => t.question !== ""))).tasks[0]!;
    expect(board).toMatchObject({ status: "waiting", question: "Drops or the diffuser?" });
    const card = (await until(() => store.cards.list(Scope.of("admin"), 10), (cards) => cards.length > 0))[0]!;
    expect(card).toMatchObject({ kind: "question", status: "open", body: "Drops or the diffuser?", action: { kind: "answer_task", run_id: runId } });
    expect(await chat()).toEqual([]);

    expect((await call("POST", "/chat", { text: "The drops.", plan_id: plan.id })).status).toBe(202);
    const ended = await until(() => store.getRun(runId), (run) => !!run && TERMINAL_STATUSES.has(run.status));
    expect(ended!.status).toBe("completed");
    expect((await chat()).map((line) => [line.role, line.text]).slice(-2)).toEqual([
      ["owner", "The drops."],
      ["operator", "Passed on."],
    ]);
    expect(await store.cards.get(Scope.of("admin"), card.id)).toMatchObject({ status: "answered", answer: "The drops." });
  });
});

describe("cards", () => {
  it("answering a paused task's card resumes it; a card is settled once", async () => {
    await harness.close();
    harness = await PiHarness.open(join(dir, "harness-3.sqlite"), models);
    app = new App({ settings: { ...settings, judgeModel: MODEL_ID }, store, harness });
    await app.workspace!.tasks.recover();
    harness.resume();
    const text = (content: unknown) => (typeof content === "string" ? content : JSON.stringify(content));
    const route: FauxResponseStep = (context) => {
      const last = text(context.messages[context.messages.length - 1]!.content);
      if (last.startsWith("Condition:")) return fauxAssistantMessage(last.includes("nothing yet") ? '{"stop": true, "question": "Which one?"}' : '{"stop": false}');
      if (last.includes("The owner answered your question")) return finish();
      return context.messages.some((m) => m.role === "toolResult") ? finish() : recordAll();
    };
    faux.setResponses(Array.from({ length: 30 }, () => route));
    const plan = (await (await call("POST", "/plans", { brief: BRIEF })).json()) as Plan;
    await call("POST", `/plans/${plan.id}/tasks/category_numbers`, { selected: false });
    const runId = ((await (await call("POST", `/plans/${plan.id}/approve`)).json()) as Plan).tasks[0]!.run_id;
    const card = (await until(() => store.cards.list(Scope.of("admin"), 10), (cards) => cards.length > 0))[0]!;
    const answered = await call("POST", `/cards/${card.id}/answer`, { answer: "The drops." });
    expect(answered.status).toBe(202);
    expect(await answered.json()).toMatchObject({ status: "answered", answer: "The drops." });
    expect((await until(() => store.getRun(runId), (run) => !!run && TERMINAL_STATUSES.has(run.status)))!.status).toBe("completed");
    expect((await call("POST", `/cards/${card.id}/answer`, { answer: "again" })).status).toBe(409);
  });

  it("an approval card starts its task only when approved, and a rejection is kept on the plan", async () => {
    faux.setResponses([recordAll(), finish()]);
    const plan = (await (await call("POST", "/plans", { brief: BRIEF })).json()) as Plan;
    const contract = { ...plan.tasks[0]!.contract, stop_when: undefined };
    const approval = await app.workspace!.cards.open("admin", {
      kind: "approval",
      title: "Approve Product facts?",
      body: "It would spend Apify money.",
      action: { kind: "start_task", brief: plan.brief, contract, plan_id: plan.id, task_key: "product_facts" },
    });
    expect((await store.listRuns(Scope.of("admin"), 10)).length).toBe(0);
    const approved = (await (await call("POST", `/cards/${approval.id}/approve`)).json()) as { answer: string };
    const run = await until(() => store.getRun(approved.answer), (r) => !!r && TERMINAL_STATUSES.has(r.status));
    expect(run!.status).toBe("completed");
    expect(((await (await call("GET", `/plans/${plan.id}`)).json()) as Plan).tasks[0]!.run_id).toBe(approved.answer);

    const action = { kind: "start_task" as const, brief: plan.brief, contract, plan_id: plan.id, task_key: "category_numbers" };
    const second = await app.workspace!.cards.open("admin", { kind: "approval", title: approval.title, body: approval.body, action });
    expect((await call("POST", `/cards/${second.id}/reject`)).status).toBe(202);
    expect(((await (await call("GET", `/plans/${plan.id}`)).json()) as Plan).tasks[1]!.error).toBe("rejected by the owner");
  });

  it("the operator's question becomes a card, and the answer comes back to it", async () => {
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("send_owner", { question: "UK only, or Ireland too?" }), { stopReason: "toolUse" }),
      fauxAssistantMessage("I've asked."),
      fauxAssistantMessage("Thanks: UK only."),
    ]);
    await call("POST", "/chat", { text: "Set the market for me." });
    const card = (await until(() => store.cards.list(Scope.of("admin"), 10), (cards) => cards.length > 0))[0]!;
    expect(card).toMatchObject({ kind: "question", body: "UK only, or Ireland too?", action: { kind: "reply_operator" } });
    await call("POST", `/cards/${card.id}/answer`, { answer: "UK only." });
    const lines = await until(chat, (seen) => seen.some((line) => line.text === "Thanks: UK only."));
    expect(lines.map((line) => line.text)).toContain('My answer to your question "UK only, or Ireland too?": UK only.');
  });
});
