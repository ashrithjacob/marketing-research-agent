/**
 * The learning loop (spec §5.3–5.4, part 6), on a real harness file with pi's faux model
 * as reviewer and worker: a correction given once becomes a lesson; approved, the next
 * task reads it.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type AssistantMessage, type MutableModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, type FauxResponseStep } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SqlResearchStore } from "../src/adapters/index.js";
import { PiHarness, RunError } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { Scope, TERMINAL_STATUSES, type Plan } from "../src/domain/index.js";
import { App } from "../src/http/index.js";
import { productPacket, recordCalls } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

const MODEL_ID = "faux-model";
const LESSON = "Never use affiliate review pages as sources.";
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
const text = (content: unknown) => (typeof content === "string" ? content : JSON.stringify(content));
const recordAll = (): AssistantMessage => fauxAssistantMessage(recordCalls(productPacket({ excerpts: [] })), { stopReason: "toolUse" });
const finish = (): AssistantMessage => fauxAssistantMessage(fauxToolCall("finish", {}), { stopReason: "toolUse" });

async function productTask(): Promise<string> {
  const plan = (await (await call("POST", "/plans", { brief: { url: "https://magnacalm.example" } })).json()) as Plan;
  for (const key of ["category_numbers", "competitors"]) await call("POST", `/plans/${plan.id}/tasks/${key}`, { selected: false });
  const runId = ((await (await call("POST", `/plans/${plan.id}/approve`)).json()) as Plan).tasks.find((t) => t.key === "product_facts")!.run_id;
  await until(() => store.getRun(runId), (run) => !!run && TERMINAL_STATUSES.has(run.status));
  return runId;
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-learning-"));
  store = await SqliteStores.open(join(dir, "research.db"));
  settings = { ...Env.settings(), model: MODEL_ID, judgeModel: "not-a-model", corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "", taskMaxUsd: 2 };
  faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  models = createModels();
  models.setProvider(faux.provider);
  harness = await PiHarness.open(join(dir, "harness.sqlite"), models);
  app = new App({ settings, store, harness });
  await app.workspace!.tasks.recover();
  harness.resume();
  const route: FauxResponseStep = (context) => {
    const first = text(context.messages.find((m) => m.role === "user")?.content ?? "");
    const started = context.messages.some((m) => m.role === "toolResult");
    if (first.startsWith("## New feedback from the owner")) {
      if (started) return fauxAssistantMessage("Done.");
      const feedbackId = /\[([0-9a-f]{32})\] reject/.exec(first)?.[1];
      if (!feedbackId) return fauxAssistantMessage("Nothing to learn: no correction here.");
      return fauxAssistantMessage(fauxToolCall("propose_lesson", { change: "add", text: LESSON, why: "The owner rejected an affiliate page.", feedback_ids: [feedbackId] }), { stopReason: "toolUse" });
    }
    return started ? finish() : recordAll();
  };
  faux.setResponses(Array.from({ length: 60 }, () => route));
});

afterEach(async () => {
  await harness.close();
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("the learning loop", () => {
  it("turns a correction into a lesson the owner approves, which the next task reads", async () => {
    const first = await productTask();
    await call("POST", `/runs/${first}/sources/${encodeURIComponent("sha256:aaa")}/wrong`, { why: "an affiliate review page" });
    expect(await app.workspace!.reviewer.sweep()).toBe(1);
    const card = (await until(() => store.cards.list(Scope.of("admin"), 10), (cards) => cards.some((c) => c.action.kind === "lesson")))[0]!;
    expect(card).toMatchObject({ kind: "approval", title: "Learn this about the brand?" });
    const lesson = (await store.lessons.list(Scope.of("admin"), 10)).find((l) => l.status === "staged")!;
    expect(lesson.change).toEqual({ kind: "memory_add", text: LESSON });

    const edited = "Never use affiliate review pages or listicles as sources.";
    expect((await call("POST", `/cards/${card.id}/approve`, { text: edited })).status).toBe(202);
    expect((await store.memory.current(Scope.of("admin"))).map((m) => [m.text, m.by, m.lesson_id])).toEqual([[edited, "lesson", lesson.id]]);

    const next = await productTask();
    const prompts = (await store.listLlmCalls(next)).map((c) => c.system_prompt ?? "").join("\n");
    expect(prompts).toContain(edited);
  });

  it("refuses a lesson without feedback, with unknown feedback, or that the owner already rejected", async () => {
    const lessons = app.workspace!.lessons;
    const change = { kind: "memory_add" as const, text: "Prefer UK sources." };
    await expect(lessons.stage("admin", change, "why", [])).rejects.toThrow(/must name the feedback/);
    await expect(lessons.stage("admin", change, "why", ["f-none"])).rejects.toThrow(/no feedback f-none/);
    const feedback = await store.feedback.record("admin", { verdict: "steer", target: { kind: "task", id: "r", run_id: "r", plan_id: "" }, text: "UK only" });
    const staged = await lessons.stage("admin", change, "why", [feedback.id]);
    const card = (await store.cards.list(Scope.of("admin"), 5)).find((c) => c.action.kind === "lesson" && c.action.lesson_id === staged.id)!;
    await call("POST", `/cards/${card.id}/reject`);
    expect((await store.lessons.get(Scope.everything, staged.id))!.status).toBe("rejected");
    expect((await store.feedback.list(Scope.of("admin"), 5))[0]).toMatchObject({ verdict: "reject", target: { kind: "lesson", id: staged.id } });
    await expect(lessons.stage("admin", { kind: "memory_add", text: "prefer UK sources" }, "why", [feedback.id])).rejects.toThrow(RunError);
  });

  it("records a review that found nothing, so the same feedback is not reviewed twice", async () => {
    await store.feedback.record("admin", { verdict: "answer", target: { kind: "card", id: "c", run_id: "", plan_id: "" }, text: "The drops." });
    expect(await app.workspace!.reviewer.sweep()).toBe(1);
    expect((await store.lessons.list(Scope.of("admin"), 5)).map((l) => l.status)).toEqual(["nothing"]);
    expect(await app.workspace!.reviewer.sweep()).toBe(0);
  });

  it("keeps every version of a memory entry the owner edits, and counts the edit as a correction", async () => {
    const added = (await (await call("POST", "/memory", { text: "Sells in the UK only." })).json()) as { entry_id: string };
    await call("POST", `/memory/${added.entry_id}`, { text: "Sells in the UK and Ireland." });
    await call("DELETE", `/memory/${added.entry_id}`);
    expect(await store.memory.current(Scope.of("admin"))).toEqual([]);
    expect((await store.memory.history(Scope.of("admin"), 10)).map((m) => [m.version, m.text, m.deleted])).toEqual([
      [3, "Sells in the UK and Ireland.", true],
      [2, "Sells in the UK and Ireland.", false],
      [1, "Sells in the UK only.", false],
    ]);
    expect((await store.feedback.list(Scope.of("admin"), 5)).map((f) => [f.verdict, f.target.kind])).toEqual([
      ["edited", "memory"],
      ["edited", "memory"],
      ["edited", "memory"],
    ]);
  });
});
