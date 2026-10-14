/**
 * Part 9 (spec §5.4–5.8): playbooks as versioned rows, a lesson from a draft edit becoming a
 * new version the next write reads, distilling a playbook from a library document, rollback,
 * the curator, and the flag on a version that did worse. pi's faux model is the reviewer and
 * the distiller, on a real harness file.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type AssistantMessage } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, type FauxResponseStep } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SqlResearchStore } from "../src/adapters/index.js";
import { CuratorWatch, PiHarness, PlaybookScores, PlaybookShelf, type VersionScore } from "../src/agent/index.js";
import { Env } from "../src/config/index.js";
import { SEED_PLAYBOOKS, Scope, TERMINAL_STATUSES } from "../src/domain/index.js";
import { App } from "../src/http/index.js";
import { SqliteStores } from "./sqlite-stores.js";

const MODEL_ID = "faux-model";
const NEW_CRITERION = "The hook names the customer's own words for the problem.";
let dir: string;
let store: SqlResearchStore;
let harness: PiHarness;
let app: App;
let distilKey = "short_static";

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

const route: FauxResponseStep = (context) => {
  const last = context.messages[context.messages.length - 1]!;
  const first = text(context.messages.find((m) => m.role === "user")?.content ?? "");
  const said = text(last.content);
  if (first.includes("Propose a playbook from it")) {
    if (last.role !== "toolResult") return step(fauxToolCall("propose_playbook", {
      key: distilKey, title: "Short static ad", read_first: ["Section 01"],
      sections: [{ key: "hook", title: "Hook", describe: "one line" }, { key: "proof", title: "Proof", describe: "one figure" }],
      criteria: ["The hook is one line.", "The proof cites a finding."], why: "Section 01 names the two parts.",
    }));
    if (said.includes("PROPOSED") || said.includes("REFUSED")) return step(fauxToolCall("finish", {}));
    return fauxAssistantMessage("Done.");
  }
  if (last.role === "user" && said.includes("## New feedback from the owner")) {
    const ids = [...said.matchAll(/- \[([0-9a-f]+)\] edited/g)].map((m) => m[1]!);
    return step(fauxToolCall("propose_playbook_change", { playbook: "long_form_static", criteria: [...SEED_PLAYBOOKS.long_form_static!.criteria, NEW_CRITERION], why: "The owner rewrote the hook in the customer's words.", feedback_ids: ids }));
  }
  return fauxAssistantMessage("Nothing to learn.");
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-playbooks-"));
  store = await SqliteStores.open(join(dir, "research.db"));
  const settings = { ...Env.settings(), model: MODEL_ID, judgeModel: "not-a-model", corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "", taskMaxUsd: 2 };
  const faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  const models = createModels();
  models.setProvider(faux.provider);
  harness = await PiHarness.open(join(dir, "harness.sqlite"), models);
  app = new App({ settings, store, harness });
  await app.workspace!.tasks.recover();
  harness.resume();
  faux.setResponses(Array.from({ length: 80 }, () => route));
  distilKey = "short_static";
});

afterEach(async () => {
  await harness.close();
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

async function draftInReview(version = 1): Promise<string> {
  const draft = await store.drafts.write("admin", "run-1", { key: "long_form_static", version }, { key: "hook", text: "A hook [[at1]]." });
  await store.drafts.mark(draft.id, "review");
  return draft.id;
}

describe("playbooks", () => {
  it("start as the seed, version 1, with an empty score", async () => {
    const reports = (await (await call("GET", "/playbooks")).json()) as { playbook: { key: string; version: number; by: string }; versions: VersionScore[]; flag: string | null }[];
    expect(reports.map((r) => [r.playbook.key, r.playbook.version, r.playbook.by])).toEqual([["long_form_static", 1, "seed"]]);
    expect(reports[0]!.versions[0]).toMatchObject({ version: 1, tasks: 0, decided: 0, roas: null });
    expect(reports[0]!.flag).toBeNull();
  });

  it("learn from an owner's draft edit: the reviewer proposes a new version, approved it is what the next write reads", async () => {
    const draftId = await draftInReview();
    await call("POST", `/drafts/${draftId}/edit`, { sections: [{ key: "hook", text: "Still coughing at 3am? [[at1]]" }] });
    expect(await app.workspace!.reviewer.sweep()).toBe(1);
    const card = await until(async () => (await store.cards.list(Scope.of("admin"), 10)).find((c) => c.action.kind === "lesson"), (c) => !!c);
    expect(card!.title).toBe('Change the playbook "Long-form static ad"?');
    expect(card!.action).toMatchObject({ editable: false });
    expect((await call("POST", `/cards/${card!.id}/approve`, {})).status).toBe(202);
    const current = (await new PlaybookShelf(store).current("admin", "long_form_static"))!;
    expect(current).toMatchObject({ version: 2, by: "lesson" });
    expect(current.criteria.at(-1)).toBe(NEW_CRITERION);
  });

  it("roll back by writing the older version again as the newest; nothing is overwritten", async () => {
    const shelf = new PlaybookShelf(store);
    const seed = (await shelf.current("admin", "long_form_static"))!;
    await store.playbooks.add("admin", { ...seed, criteria: ["only one"] }, "lesson", "l1");
    const rolled = (await (await call("POST", "/playbooks/long_form_static/rollback", { version: 1 })).json()) as { version: number; by: string; criteria: string[] };
    expect(rolled).toMatchObject({ version: 3, by: "rollback", criteria: seed.criteria });
    expect((await store.playbooks.history("admin", "long_form_static")).map((p) => p.version)).toEqual([3, 2, 1]);
    expect((await call("POST", "/playbooks/long_form_static/rollback", { version: 3 })).status).toBe(400);
  });

  it("distil one from a library document, as a lesson card; approved, it is a playbook a write can name", async () => {
    const document = await store.library.add("admin", { title: "Short Statics", filename: "s.pdf" });
    await store.library.finish(document.id, { markdown: "# Section 01\n\nA hook, then a proof.\n", pages: 1 });
    const started = await call("POST", `/library/${document.id}/distil`);
    expect(started.status).toBe(202);
    const run = (await started.json()) as { id: string };
    expect((await until(() => store.getRun(run.id), (r) => !!r && TERMINAL_STATUSES.has(r.status)))!.status).toBe("completed");
    const card = (await store.cards.list(Scope.of("admin"), 10)).find((c) => c.action.kind === "lesson")!;
    expect(card.title).toBe('Add the playbook "Short static ad"?');
    await call("POST", `/cards/${card.id}/approve`, {});
    expect(await new PlaybookShelf(store).current("admin", "short_static")).toMatchObject({ version: 1, by: "lesson", document_title: "Short Statics" });
  });

  it("refuse to distil over a key that exists, so the distiller is told to change it instead", async () => {
    distilKey = "long_form_static";
    const document = await store.library.add("admin", { title: "Again", filename: "a.pdf" });
    await store.library.finish(document.id, { markdown: "# Section 01\n\nx\n", pages: 1 });
    const run = (await (await call("POST", `/library/${document.id}/distil`)).json()) as { id: string };
    expect((await until(() => store.getRun(run.id), (r) => !!r && TERMINAL_STATUSES.has(r.status)))!.status).not.toBe("completed");
    expect((await store.listPacketChecks(run.id))[0]!.problems[0]).toContain("no playbook proposed yet");
    expect((await store.cards.list(Scope.of("admin"), 10)).some((c) => c.action.kind === "lesson")).toBe(false);
  });
});

describe("the curator", () => {
  it("marks a playbook unread for 30 days stale and for 90 archived, at most once a day, and only forward", async () => {
    const said: string[] = [];
    const curator = new CuratorWatch(store, async (_ws, line) => void said.push(line));
    await new PlaybookShelf(store).list("admin");
    const day = 86_400_000;
    const now = Date.now();
    await curator.check("admin", now + 31 * day);
    expect((await store.playbooks.current(Scope.of("admin"), "long_form_static"))!.status).toBe("stale");
    expect(said).toEqual(["Curator: Long-form static ad is now stale."]);
    expect(await curator.check("admin", now + 31.5 * day)).toBe(now + 32 * day);
    await curator.check("admin", now + 91 * day);
    expect((await store.playbooks.current(Scope.of("admin"), "long_form_static"))!.status).toBe("archived");
    const write = { brief: { product: "MagnaCalm", url: "", market: "", notes: "" }, contract: { objective: "w", primitive: "write", complete: { shape: "draft", playbook: "long_form_static" }, inputs: { finding_ids: ["r/at1"] }, budget: { max_usd: 1, max_minutes: 5 } } };
    expect(((await (await call("POST", "/tasks", write)).json()) as { detail: string }).detail).toContain("no writing playbook 'long_form_static'");
  });
});

describe("a version's score", () => {
  const score = (version: number, decided: number, accepted: number, ads = 0, roas: number | null = null): VersionScore => ({
    version, by: "lesson", created_at: "", tasks: decided, first_try: decided, decided, accepted_unchanged: accepted, corrected: decided - accepted, ads, spend: 0, roas,
  });

  it("flags a newer version that the owner accepted unchanged less often, over enough drafts", () => {
    expect(PlaybookScores.flag([score(2, 5, 1), score(1, 5, 4)])).toBe("version 2: 1 of 5 drafts accepted unchanged, against 4 of 5 on version 1");
    expect(PlaybookScores.flag([score(2, 4, 0), score(1, 5, 5)])).toBeNull();
  });

  it("flags a newer version whose ads returned less, over enough ads", () => {
    expect(PlaybookScores.flag([score(2, 0, 0, 3, 1.5), score(1, 0, 0, 3, 2.5)])).toBe("version 2: return on ad spend 1.50 over 3 ads, against 2.50 over 3 on version 1");
    expect(PlaybookScores.flag([score(2, 0, 0, 2, 1.0), score(1, 0, 0, 3, 2.5)])).toBeNull();
  });
});

describe("what the watchers are pointed at", () => {
  it("takes a Meta ad account by its digits, a competitor by brand or domain, and an ad id only for an approved draft", async () => {
    expect((await call("POST", "/ad-accounts", { account_id: "not-an-id" })).status).toBe(400);
    expect(await (await call("POST", "/ad-accounts", { account_id: "act_123456" })).json()).toMatchObject({ account_id: "123456", status: "connected" });
    expect((await call("POST", "/watch/brands", { term: "Rival", search_in: "page" })).status).toBe(400);
    expect((await call("POST", "/watch/brands", { term: "rival.example", search_in: "domain" })).status).toBe(201);
    const draftId = await draftInReview();
    expect(((await (await call("POST", `/drafts/${draftId}/ads`, { ad_id: "777777" })).json()) as { detail: string }).detail).toBe("only an approved draft can be linked to an ad");
    await store.drafts.mark(draftId, "approved");
    expect((await call("POST", `/drafts/${draftId}/ads`, { ad_id: "777777" })).status).toBe(201);
    const ads = (await (await call("GET", `/drafts/${draftId}/ads`)).json()) as { data: { ad_id: string; by: string; settled: { days: number } }[] };
    expect(ads.data).toMatchObject([{ ad_id: "777777", by: "owner", settled: { days: 0 } }]);
  });
});
