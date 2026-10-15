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
import { minimalPacket, productPacket, recordCalls } from "./fixtures.js";
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
let looked: string[];

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

async function chat(brand = ""): Promise<ChatMessage[]> {
  let seen: ChatMessage[] = [];
  const stop = await app.workspace!.operator.watch("admin", brand, (lines) => (seen = lines));
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
  looked = [];
  app = new App({ settings, store, harness, brandImages: { read: async (page) => (looked.push(page), { share: `${page}og.png`, icon: "" }) } });
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
    expect(plan.status).toBe("draft");
    expect(plan.tasks.map((t) => [t.key, t.selected, t.auto, t.after])).toEqual([
      ["champion", true, true, []],
      ["product_facts", true, false, ["champion"]],
      ["competitors", true, false, ["champion"]],
      ["category_numbers", true, false, ["champion"]],
    ]);
    expect((await store.listRuns({ workspaceId: null } as never)).length).toBe(0);

    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("revise_plan", { plan_id: plan.id, drop: ["category_numbers", "competitors"], market: "UK" }), { stopReason: "toolUse" }),
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
    expect(revised.tasks.map((t) => [t.key, t.selected, t.after])).toEqual([
      ["champion", false, []],
      ["product_facts", true, []],
      ["competitors", false, []],
      ["category_numbers", false, []],
    ]);

    const toggled = (await (await call("POST", `/plans/${plan.id}/tasks/category_numbers`, { selected: false })).json()) as Plan;
    expect(toggled.tasks.find((t) => t.key === "category_numbers")!.selected).toBe(false);
    expect((await call("POST", `/plans/${plan.id}/tasks/champion`, { selected: true })).status).toBe(400);

    faux.setResponses([recordAll(), finish()]);
    const approved = await call("POST", `/plans/${plan.id}/approve`);
    expect(approved.status).toBe(202);
    const body = (await approved.json()) as Plan;
    expect(body.status).toBe("approved");
    const runId = body.tasks.find((t) => t.key === "product_facts")!.run_id;
    expect(runId).not.toBe("");
    expect(body.tasks.filter((t) => t.run_id).map((t) => t.key)).toEqual(["product_facts"]);
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
    expect(plan.tasks.find((t) => t.key === "product_facts")!.contract.stop_when).toContain("more than one product");
    for (const key of ["category_numbers", "competitors"]) await call("POST", `/plans/${plan.id}/tasks/${key}`, { selected: false });
    runId = ((await (await call("POST", `/plans/${plan.id}/approve`)).json()) as Plan).tasks.find((t) => t.key === "product_facts")!.run_id;
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
    for (const key of ["category_numbers", "competitors"]) await call("POST", `/plans/${plan.id}/tasks/${key}`, { selected: false });
    const runId = ((await (await call("POST", `/plans/${plan.id}/approve`)).json()) as Plan).tasks.find((t) => t.key === "product_facts")!.run_id;
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
    const contract = { ...plan.tasks.find((t) => t.key === "product_facts")!.contract, stop_when: undefined };
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
    expect(((await (await call("GET", `/plans/${plan.id}`)).json()) as Plan).tasks.find((t) => t.key === "product_facts")!.run_id).toBe(approved.answer);

    const action = { kind: "start_task" as const, brief: plan.brief, contract, plan_id: plan.id, task_key: "category_numbers" };
    const second = await app.workspace!.cards.open("admin", { kind: "approval", title: approval.title, body: approval.body, action });
    expect((await call("POST", `/cards/${second.id}/reject`)).status).toBe(202);
    expect(((await (await call("GET", `/plans/${plan.id}`)).json()) as Plan).tasks.find((t) => t.key === "category_numbers")!.error).toBe("rejected by the owner");
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

describe("stage 1 as a plan", () => {
  it("starts the champion first behind its Apify approval, then the tasks that measure against it, each with the champion's row copied in", async () => {
    const champion = {
      sources: [{ ...minimalPacket().sources[0], id: "sha256:ccc", url: "https://amazon.example/magnacalm", kind: "competitor_marketing", node: "competitors" }],
      competitor_reference: { name: "MagnaCalm Glycinate", form: "capsule", actives: ["magnesium glycinate"], icp: "adults with a cough", source_id: "sha256:ccc" },
      gaps: [{ node: "competitors", missing: "champion ranking unavailable: no Amazon search in tests" }],
    };
    const text = (content: unknown) => (typeof content === "string" ? content : JSON.stringify(content));
    const route: FauxResponseStep = (context) => {
      const task = text(context.messages.find((m) => m.role === "user")?.content ?? "");
      const started = context.messages.some((m) => m.role === "toolResult");
      if (task.includes("Your task: find the champion")) return started ? finish() : fauxAssistantMessage(recordCalls(champion), { stopReason: "toolUse" });
      if (task.includes("Your task: the product's fact sheet")) return started ? finish() : recordAll();
      return fauxAssistantMessage("nothing to do here");
    };
    faux.setResponses(Array.from({ length: 30 }, () => route));
    const plan = (await (await call("POST", "/plans", { brief: { product: "magnesium glycinate" } })).json()) as Plan;
    await call("POST", `/plans/${plan.id}/tasks/category_numbers`, { selected: false });
    const approved = (await (await call("POST", `/plans/${plan.id}/approve`)).json()) as Plan;
    expect(approved.tasks.map((t) => [t.key, t.run_id !== "", t.error])).toEqual([
      ["champion", false, "waiting for your approval: it would spend Apify money"],
      ["product_facts", false, ""],
      ["competitors", false, ""],
      ["category_numbers", false, ""],
    ]);
    expect((await store.listRuns(Scope.of("admin"), 10)).length).toBe(0);

    const first = (await store.cards.list(Scope.of("admin"), 10)).find((c) => c.kind === "approval")!;
    expect(first.title).toBe("Approve Champion product?");
    await call("POST", `/cards/${first.id}/approve`);
    const released = await until(
      async () => ((await (await call("GET", `/plans/${plan.id}`)).json()) as Plan).tasks,
      (tasks) => tasks.find((t) => t.key === "product_facts")!.run_id !== "",
    );
    const productRun = released.find((t) => t.key === "product_facts")!.run_id;
    expect(released.find((t) => t.key === "competitors")!.error).toBe("waiting for your approval: it would spend Apify money");
    const copied = (await store.findings.list(productRun)).filter((row) => row.agent_id === "champion");
    expect(copied.map((row) => [row.kind, row.payload.node ?? null])).toEqual([
      ["source", "product_data"],
      ["competitor_reference", null],
      ["gap", "product_data"],
    ]);
    expect((await until(() => store.getRun(productRun), (run) => !!run && TERMINAL_STATUSES.has(run.status)))!.status).toBe("completed");
    const open = (await store.cards.list(Scope.of("admin"), 10)).filter((c) => c.status === "open").map((c) => c.title);
    expect(open).toEqual(["Approve Competitors?"]);
  });
});

describe("feedback", () => {
  it("records each of the owner's actions against what it was about", async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    faux.setResponses([async () => (await held, recordAll()), finish()]);
    const plan = (await (await call("POST", "/plans", { brief: BRIEF })).json()) as Plan;
    for (const key of ["category_numbers", "competitors"]) await call("POST", `/plans/${plan.id}/tasks/${key}`, { selected: false });
    const approved = (await (await call("POST", `/plans/${plan.id}/approve`)).json()) as Plan;
    const runId = approved.tasks.find((t) => t.key === "product_facts")!.run_id;
    await until(() => store.getRun(runId), (run) => run?.status === "running");
    expect(await app.workspace!.tasks.guide(runId, "Prefer the UK site.")).toBe(true);
    release();
    await until(() => store.getRun(runId), (run) => !!run && TERMINAL_STATUSES.has(run.status));

    const wrong = await call("POST", `/runs/${runId}/sources/${encodeURIComponent("sha256:aaa")}/wrong`, { why: "an affiliate page, not the brand's" });
    expect(wrong.status).toBe(201);
    expect((await call("POST", `/runs/${runId}/sources/${encodeURIComponent("sha256:nope")}/wrong`, { why: "x" })).status).toBe(404);
    const card = await app.workspace!.cards.open("admin", {
      kind: "approval",
      title: "Approve Competitors?",
      body: "It would spend Apify money.",
      action: { kind: "start_task", brief: plan.brief, contract: plan.tasks[2]!.contract, plan_id: plan.id, task_key: "competitors" },
    });
    await call("POST", `/cards/${card.id}/reject`);

    const log = ((await (await call("GET", "/feedback")).json()) as { data: { verdict: string; strength: string; target: Record<string, string>; text: string; diff: unknown }[] }).data.reverse();
    expect(log.map((f) => [f.verdict, f.strength, f.target.kind])).toEqual([
      ["edited", "correction", "contract"],
      ["edited", "correction", "contract"],
      ["accept", "confirmation", "contract"],
      ["steer", "correction", "task"],
      ["reject", "correction", "source"],
      ["reject", "correction", "card"],
    ]);
    expect(log[0]!.diff).toEqual({ drop: ["category_numbers"] });
    expect(log[2]!.target).toMatchObject({ id: "product_facts", plan_id: plan.id, run_id: runId });
    expect(log[3]).toMatchObject({ text: "Prefer the UK site.", target: { run_id: runId } });
    expect(log[4]).toMatchObject({ text: "an affiliate page, not the brand's", target: { id: "sha256:aaa", run_id: runId } });
    expect(log[5]!.target).toMatchObject({ kind: "card", id: card.id, plan_id: plan.id });
  });
});

describe("chat starts the work", () => {
  const text = (content: unknown) => (typeof content === "string" ? content : JSON.stringify(content));

  it("a pasted link starts stage 1 as a url brief, the champion behind its Approve card and the rest after it; the message is feedback for the reviewer", async () => {
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("start_stage_one", { url: "https://magnacalm.example" }), { stopReason: "toolUse" }),
      fauxAssistantMessage("Started. The champion needs your approval first."),
    ]);
    await call("POST", "/chat", { text: "research https://magnacalm.example" });
    await until(chat, (seen) => seen.some((line) => line.role === "operator" && !line.partial));
    const plan = (await store.plans.list(Scope.of("admin"), 5))[0]!;
    expect(plan).toMatchObject({ status: "approved", brief: { url: "https://magnacalm.example", product: "" } });
    expect(plan.tasks.map((t) => [t.key, t.run_id, t.error, t.after])).toEqual([
      ["champion", "", "waiting for your approval: it would spend Apify money", []],
      ["product_facts", "", "", ["champion"]],
      ["competitors", "", "", ["champion"]],
      ["category_numbers", "", "", ["champion"]],
    ]);
    expect((await store.cards.list(Scope.of("admin"), 10)).map((c) => [c.kind, c.title, c.status])).toEqual([["approval", "Approve Champion product?", "open"]]);
    expect((await store.listRuns(Scope.of("admin"), 10)).length).toBe(0);
    const said = (await store.feedback.list(Scope.of("admin"), 10)).filter((f) => f.verdict === "said");
    expect(said.map((f) => [f.strength, f.target.kind, f.text])).toEqual([["instruction", "chat", "research https://magnacalm.example"]]);
  });

  it("a brand opened with a link gets its own chat: the research it starts reports there, and its tile lists the product with the site's graphic", async () => {
    const route: FauxResponseStep = (context) => {
      const first = text(context.messages.find((m) => m.role === "user")?.content ?? "");
      const started = context.messages.some((m) => m.role === "toolResult");
      if (first.includes("Your task: the product's fact sheet")) return started ? finish() : recordAll();
      if (context.messages.some((m) => m.role === "user" && text(m.content).startsWith("[Signal]"))) return fauxAssistantMessage("Product facts are in: 1 source, nothing missing.");
      return started ? fauxAssistantMessage("Started the product facts.") : fauxAssistantMessage(fauxToolCall("start_stage_one", { url: "https://magnacalm.example", parts: ["product_facts"] }), { stopReason: "toolUse" });
    };
    faux.setResponses(Array.from({ length: 20 }, () => route));
    const opened = await call("POST", "/brands", { text: "https://www.magnacalm.example/" });
    expect(opened.status).toBe(201);
    const { key } = (await opened.json()) as { key: string };
    expect(key).toBe("site:magnacalm.example");

    const plan = await until(async () => (await store.plans.list(Scope.of("admin"), 5))[0], (p) => !!p?.tasks.find((t) => t.key === "product_facts")?.run_id);
    expect(plan!.tasks.filter((t) => t.selected).map((t) => t.key)).toEqual(["product_facts"]);
    const runId = plan!.tasks.find((t) => t.key === "product_facts")!.run_id;
    expect((await until(() => store.getRun(runId), (run) => !!run && TERMINAL_STATUSES.has(run.status)))!.status).toBe("completed");
    const lines = await until(() => chat(key), (seen) => seen.some((line) => line.text.startsWith("Product facts are in")));
    expect(lines.filter((line) => !line.partial).map((line) => [line.role, line.text])).toEqual([
      ["owner", "https://www.magnacalm.example/"],
      ["operator", "Started the product facts."],
      ["operator", "Product facts are in: 1 source, nothing missing."],
    ]);
    expect(await chat()).toEqual([]);

    await call("GET", "/brands");
    await app.workspace!.brands.settled();
    const brands = ((await (await call("GET", "/brands")).json()) as { data: { key: string; label: string; image_url: string; products: { key: string }[] }[] }).data;
    expect(brands.map((b) => [b.key, b.label, b.image_url, b.products.map((p) => p.key)])).toEqual([
      ["site:magnacalm.example", "magnacalm.example", "https://magnacalm.example/og.png", ["page:magnacalm.example"]],
    ]);
    expect(looked).toEqual(["https://magnacalm.example/"]);
  });

  it("a brand's chat is there before any research is, and refuses an empty start", async () => {
    faux.setResponses([fauxAssistantMessage("What would you like to know about it?")]);
    const { key } = (await (await call("POST", "/brands", { text: "Magnesium Glycinate" })).json()) as { key: string };
    expect(key).toBe("product:magnesiumglycinate");
    const brands = ((await (await call("GET", "/brands")).json()) as { data: { key: string; label: string; products: unknown[] }[] }).data;
    expect(brands.map((b) => [b.key, b.label, b.products.length])).toEqual([["product:magnesiumglycinate", "Magnesium Glycinate", 0]]);
    expect((await call("POST", "/brands", { text: "  " })).status).toBe(400);
  });

  it("an unknown part comes back to the operator as an error, and nothing starts", async () => {
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("start_stage_one", { product: "magnesium glycinate", parts: ["ads"] }), { stopReason: "toolUse" }),
      (context) => fauxAssistantMessage(text(context.messages.at(-1)?.content)),
    ]);
    await call("POST", "/chat", { text: "the ads part for magnesium glycinate" });
    const lines = await until(chat, (seen) => seen.some((line) => line.role === "operator" && !line.partial));
    expect(lines.at(-1)!.text).toContain("no stage-1 part ads; the parts are product_facts, competitors, category_numbers");
    expect(await store.plans.list(Scope.of("admin"), 5)).toEqual([]);
  });
});
