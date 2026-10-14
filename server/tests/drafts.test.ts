/**
 * Part 8 (spec §3.1, `write` and `critique`): a long-form static written from a plan's
 * findings, citing them by id, critiqued against its playbook, then settled by the owner.
 * pi's faux model is the writer and the critic, on a real harness file.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type AssistantMessage } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, type FauxResponseStep } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SqlResearchStore } from "../src/adapters/index.js";
import { PiHarness } from "../src/agent/index.js";
import { Env } from "../src/config/index.js";
import { PLAYBOOKS, Scope, TERMINAL_STATUSES, type Draft, type Finding } from "../src/domain/index.js";
import { DraftCheck } from "../src/extract/index.js";
import { App } from "../src/http/index.js";
import { minimalPacket } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

const MODEL_ID = "faux-model";
const BRIEF = { product: "MagnaCalm 400mg", url: "", market: "UK", notes: "" };
const PLAYBOOK = PLAYBOOKS.long_form_static!;
let dir: string;
let store: SqlResearchStore;
let harness: PiHarness;
let app: App;
let writing: "cited" | "typed" = "cited";

const call = (method: string, path: string, body?: unknown) =>
  app.fetch(new Request(`http://mra.test/api/research${path}`, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
async function until<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  for (let i = 0; i < 600; i++) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out");
}
const text = (content: unknown) => (typeof content === "string" ? content : JSON.stringify(content));
const step = (...calls: ReturnType<typeof fauxToolCall>[]): AssistantMessage => fauxAssistantMessage(calls, { stopReason: "toolUse" });

/** The writer reads its findings, writes every section from the first two ids it was shown, and finishes; the critic reads, gives each criterion a verdict, and finishes. */
const route: FauxResponseStep = (context) => {
  const first = text(context.messages.find((m) => m.role === "user")?.content ?? "");
  const results = context.messages.filter((m) => m.role === "toolResult").map((m) => text(m.content));
  const last = results[results.length - 1] ?? "";
  if (first.includes("## The draft:")) {
    if (results.length === 0) return step(fauxToolCall("read_inputs", {}));
    if (last.includes("<findings>")) {
      const ids = [...last.matchAll(/(?:\\n|>)([a-z]+\d+) · attribute/g)].map((m) => m[1]!);
      const body = (key: string) => (writing === "typed" ? `Over 400 people tried it [[${ids[0]}]].` : `${key}: it holds {{${ids[0]}}} per serving [[${ids[0]}]] as a ${"{{"}${ids[1]}${"}}"} [[${ids[1]}]].`);
      return step(...PLAYBOOK.sections.map((s) => fauxToolCall("write_section", { section: s.key, text: body(s.key) })));
    }
    if (last.startsWith("FINISHED") || last.startsWith("NOT CHECKED")) return fauxAssistantMessage("Done.");
    return step(fauxToolCall("finish", {}));
  }
  if (first.includes("## The criteria")) {
    if (results.length === 0) return step(fauxToolCall("read_draft", {}));
    if (last.includes("<draft>")) return step(...PLAYBOOK.criteria.map((_c, i) => fauxToolCall("record_verdict", { criterion: i + 1, pass: i !== 2, why: i === 2 ? "The mechanism is not new." : "Met." })));
    if (last.startsWith("FINISHED")) return fauxAssistantMessage("Done.");
    return step(fauxToolCall("finish", {}));
  }
  return fauxAssistantMessage("Noted.");
};

async function planWithFindings(): Promise<string> {
  const packet = minimalPacket();
  const run = await store.createRun({ workspaceId: "admin", brief: BRIEF, model: "m", rejectKinds: [], judgementIds: [], nodes: ["product_data"], contract: { objective: "facts" } });
  await store.findings.append({ run_id: run.id, kind: "source", entity: "product", agent_id: "product", source_id: "", payload: packet.sources[0] });
  await store.findings.append({ run_id: run.id, kind: "attribute", entity: "product", agent_id: "product", source_id: "sha256:aaa", payload: packet.attributes[0] });
  await store.findings.append({ run_id: run.id, kind: "attribute", entity: "product", agent_id: "product", source_id: "sha256:aaa", payload: { id: "a2", node: "product_data", key: "form", value: "capsule", source_id: "sha256:aaa" } });
  await store.updateRun(run.id, { status: "completed" });
  const contract = { objective: "facts", primitive: "research", complete: { shape: "fields", node: "product_data", fields: [{ key: "form", record: "attribute", required: true, describe: "form" }] }, budget: { max_usd: 1, max_minutes: 5 } };
  const plan = await store.plans.create("admin", BRIEF, [{ key: "product_facts", title: "Facts", contract: contract as never, selected: true, auto: false, after: [], run_id: run.id, error: "" }]);
  return plan.id;
}

const drafts = () => store.drafts.list(Scope.of("admin"), 10);
const ended = (runId: string) => until(() => store.getRun(runId), (r) => !!r && TERMINAL_STATUSES.has(r.status));

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-drafts-"));
  store = await SqliteStores.open(join(dir, "research.db"));
  const settings = { ...Env.settings(), model: MODEL_ID, judgeModel: "not-a-model", corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "", taskMaxUsd: 2 };
  const faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  const models = createModels();
  models.setProvider(faux.provider);
  harness = await PiHarness.open(join(dir, "harness.sqlite"), models);
  app = new App({ settings, store, harness });
  await app.workspace!.tasks.recover();
  harness.resume();
  faux.setResponses(Array.from({ length: 120 }, () => route));
  writing = "cited";
});

afterEach(async () => {
  await harness.close();
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("a long-form static, from a plan's findings to the owner", () => {
  it("writes a draft that cites its findings, critiques it, and asks the owner", async () => {
    const planId = await planWithFindings();
    const started = await call("POST", `/plans/${planId}/write`, { playbook: "long_form_static" });
    if (started.status !== 202) throw new Error(await started.text());
    const write = (await started.json()) as { id: string };
    expect((await ended(write.id))!.status).toBe("completed");

    const draft = (await until(drafts, (all) => all[0]?.status === "review"))[0]!;
    expect(draft.sections.map((s) => s.key)).toEqual(PLAYBOOK.sections.map((s) => s.key));
    expect(draft.verdicts).toHaveLength(PLAYBOOK.criteria.length);
    expect(draft.verdicts.filter((v) => !v.pass).map((v) => v.criterion)).toEqual([PLAYBOOK.criteria[2]]);
    const critique = (await store.listRuns(Scope.of("admin"), 20)).find((r) => (r.contract as { primitive?: string } | null)?.primitive === "critique")!;
    expect((await ended(critique.id))!.status).toBe("completed");

    const page = (await (await call("GET", `/drafts/${draft.id}`)).json()) as { view: { sections: { text: string }[]; notes: { value: string }[] } };
    expect(page.view.sections[0]!.text).toBe("hook: it holds 400 mg per serving [1] as a capsule [2].");
    expect(page.view.notes.map((n) => n.value)).toEqual(["400 mg", "capsule"]);

    const card = (await store.cards.list(Scope.of("admin"), 10)).find((c) => c.action.kind === "draft")!;
    expect(card.status).toBe("open");
    expect(card.body).toContain("5 criteria met, 1 not");
  });

  it("keeps every owner edit as a new version with its diff, and settles the card on approval", async () => {
    const planId = await planWithFindings();
    await call("POST", `/plans/${planId}/write`, {});
    const draft = (await until(drafts, (all) => all[0]?.status === "review"))[0]!;
    const edited = (await (await call("POST", `/drafts/${draft.id}/edit`, { sections: [{ key: "hook", text: "A sharper hook." }] })).json()) as Draft;
    expect(edited).toMatchObject({ version: 2, by: "owner", status: "review" });
    expect(edited.sections.find((s) => s.key === "hook")!.text).toBe("A sharper hook.");
    const card = (await store.cards.list(Scope.of("admin"), 10)).find((c) => c.action.kind === "draft")!;
    expect((await call("POST", `/cards/${card.id}/approve`, {})).status).toBe(202);
    expect((await store.drafts.get(Scope.of("admin"), draft.id))!).toMatchObject({ status: "approved", version: 2 });
    expect((await store.cards.get(Scope.of("admin"), card.id))!.status).toBe("approved");
    const feedback = await store.feedback.list(Scope.of("admin"), 10);
    expect(feedback.filter((f) => f.target.kind === "draft").map((f) => f.verdict).sort()).toEqual(["accept", "edited"]);
    expect(feedback.find((f) => f.verdict === "edited")!.diff).toMatchObject({ hook: { after: "A sharper hook." } });
    expect((await call("POST", `/drafts/${draft.id}/reject`, {})).status).toBe(400);
  });

  it("refuses a draft with a figure typed by hand, so the writer never passes and nothing is critiqued", async () => {
    writing = "typed";
    const planId = await planWithFindings();
    const write = (await (await call("POST", `/plans/${planId}/write`, {})).json()) as { id: string };
    const run = (await ended(write.id))!;
    expect(run.status).not.toBe("completed");
    const checks = await store.listPacketChecks(write.id);
    expect(checks[0]!.problems[0]).toContain("types the figure(s) 400 by hand");
    expect((await store.listRuns(Scope.of("admin"), 20)).some((r) => (r.contract as { primitive?: string } | null)?.primitive === "critique")).toBe(false);
    expect((await drafts())[0]!.status).toBe("review");
  });

  it("refuses a write with nothing found to write from", async () => {
    const plan = await store.plans.create("admin", BRIEF, []);
    expect((await call("POST", `/plans/${plan.id}/write`, {})).status).toBe(400);
  });
});

describe("DraftCheck", () => {
  const row = (id: string): Finding => ({ id, seq: 1, run_id: "r", kind: "attribute", entity: "product", agent_id: "a", source_id: "s", payload: { value: "400 mg" }, created_at: "", retracted_at: "", retracted_why: "" });
  const draft = (sections: Record<string, string>): Draft => ({
    id: "d", version: 1, workspace_id: "w", run_id: "r", playbook: PLAYBOOK.key, by: "writer", status: "writing", verdicts: [], created_at: "",
    sections: Object.entries(sections).map(([key, text]) => ({ key, text })),
  });
  const all = (text: string) => Object.fromEntries(PLAYBOOK.sections.map((s) => [s.key, text]));

  it("passes a draft where every section cites a finding and figures come from findings", () => {
    expect(DraftCheck.problems(PLAYBOOK, draft(all("It holds {{at1}} [[at1]].")), [row("at1")])).toEqual([]);
  });

  it("names a missing section, an uncited one, an unknown id and a typed figure", () => {
    const problems = DraftCheck.problems(PLAYBOOK, draft({ ...all("Fine [[at1]]."), hook: "", lead: "No citation.", mechanism: "See [[x9]].", close: "Over 400 sold [[at1]]." }), [row("at1")]).map((p) => p.text);
    expect(problems).toEqual([
      expect.stringContaining("section `hook` (Hook / Headline) is not written"),
      expect.stringContaining("section `lead` cites no finding"),
      expect.stringContaining("section `mechanism` names x9"),
      expect.stringContaining("section `close` types the figure(s) 400 by hand"),
    ]);
  });
});
