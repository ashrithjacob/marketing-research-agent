/**
 * One store, two engines. Every statement is written once, in the SQL both
 * SQLite and Postgres accept; this runs the store's dialect-sensitive paths on
 * each, so a construct only one of them speaks fails here and not in production.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PostgresDialect, type SqlResearchStore } from "../src/adapters/index.js";
import { Scope, type LlmCallRecord, type ReviewLedgerSnapshot } from "../src/domain/index.js";

import { minimalPacket } from "./fixtures.js";
import { PostgresStores } from "./postgres-stores.js";
import { SqliteStores } from "./sqlite-stores.js";

type Engine = { store: SqlResearchStore; stop(): Promise<void> };

const ENGINES: ReadonlyArray<readonly [string, () => Promise<Engine>]> = [
  ["sqlite", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mra-engine-"));
    const store = await SqliteStores.open(join(dir, "research.db"));
    return { store, stop: async () => { await store.close(); rmSync(dir, { recursive: true, force: true }); } };
  }],
  ["postgres", () => PostgresStores.start()],
];

const ledger = (runRefs: string[]): ReviewLedgerSnapshot => ({
  pulls: [{ handle: "p1", source_id: "s", target_id: "product", platform: "amazon", listing: "L", band_requested: 3, fetched_at: "", archived: true, total_reviews: null, total_ratings: null, gap: null }],
  reviews: runRefs.map((ref) => ({ ref, pull: "p1", platform: "amazon", review_key: `K-${ref}`, listing: "L", star: 3, title: "t", text: "works", posted_at: "", verified: true, locator: "" })),
});

const call = (runId: string, seq: number): LlmCallRecord => ({
  run_id: runId, seq, agent_id: "product", started_at: "a", ended_at: "b", duration_ms: 5, model: "m",
  system_prompt: null, tools: null, context_reset: false, context_messages: 1, input: [], output: {}, stop_reason: "stop",
  error: "", usage: {}, response_id: `resp-${seq}`,
});

describe.each(ENGINES)("the store on %s", (_name, start) => {
  let engine: Engine;
  let store: SqlResearchStore;
  const run = async (product = "Mullevia", workspaceId = "admin") =>
    store.createRun({ workspaceId, brief: { product }, model: "m", rejectKinds: [], judgementIds: [] });

  beforeEach(async () => {
    engine = await start();
    store = engine.store;
  }, 30_000);
  afterEach(async () => engine.stop());

  it("keeps runs inside their workspace, and lists every run for the admin scope", async () => {
    const mine = await run("A", "w1");
    await run("B", "w2");
    expect((await store.listRuns(Scope.of("w1"))).map((r) => r.id)).toEqual([mine.id]);
    expect(await store.listRuns(Scope.everything)).toHaveLength(2);
    await store.updateRun(mine.id, { status: "completed", packet: minimalPacket() });
    expect((await store.getRun(mine.id))).toMatchObject({ status: "completed", packet: minimalPacket() });
  });

  it("numbers events, packet checks and calls, and replays events after an id", async () => {
    const { id } = await run();
    const first = await store.addEvent(id, "a", { n: 1 });
    const second = await store.addEvent(id, "b", { n: 2 });
    expect(second.id).toBeGreaterThan(first.id);
    expect(await store.lastEventId(id)).toBe(second.id);
    expect((await store.listEvents(id, first.id)).map((e) => e.payload)).toEqual([{ n: 2 }]);
    await store.addPacketCheck(id, false, ["x"]);
    expect((await store.addPacketCheck(id, true, [])).seq).toBe(2);
    const added = await store.addLlmCall(call(id, 1));
    expect(typeof added.id).toBe("number");
    await store.setLlmCallGeneration(id, "resp-1", { model: "m", cost: 0.0001234567, latency_ms: 1, generation_ms: 1, reasoning_tokens: null, provider: "p" });
    expect((await store.listLlmCalls(id))[0]!.billed_cost).toBe(0.0001234567);
  });

  it("gives concurrent ledger appends to one run distinct numbers", async () => {
    const { id } = await run();
    const draft = { run_id: id, kind: "source" as const, entity: "", agent_id: "a", source_id: "", payload: {} };
    const rows = await Promise.all(Array.from({ length: 12 }, () => store.findings.append(draft)));
    expect(rows.map((r) => r.seq).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect((await store.findings.retract(id, rows[0]!.id, "wrong"))?.retracted_why).toBe("wrong");
  });

  it("stores a review once across runs, lists a run's reviews in ledger order, and counts them as a number", async () => {
    const a = await run();
    const b = await run();
    await store.saveRunReviews(a.id, ledger(["r3", "r1", "r2"]));
    await store.saveRunReviews(b.id, ledger(["r1"]));
    expect((await store.listRunReviews(a.id)).map((r) => [r.ref, r.verified])).toEqual([["r3", true], ["r1", true], ["r2", true]]);
    expect((await store.products.get(a.product_id, Scope.everything))?.review_count).toBe(3);
  });

  it("files packet rows under the product, oldest run first", async () => {
    const a = await run();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const b = await run();
    await store.updateRun(b.id, { packet: minimalPacket() });
    await store.updateRun(a.id, { packet: minimalPacket() });
    expect((await store.products.packetRows(a.product_id, Scope.everything)).attributes.map((r) => r.run_id)).toEqual([a.id, b.id]);
  });

  it("keeps a charge's dollars to the cent and beyond", async () => {
    const { id } = await run();
    await store.charges.add({ run_id: id, agent_id: null, service: "apify", item: "x", units: 1.5, usd: 0.0123456789, basis: "billed" });
    expect(await store.charges.list(id)).toMatchObject([{ agent_id: null, units: 1.5, usd: 0.0123456789 }]);
  });

  it("finds a stored pull by its band, telling no band from band 3", async () => {
    const result = { status: "SUCCEEDED", excerpts: [], gap: null, offBand: 0, totalReviews: null, totalRatings: null };
    await store.pulls.save("amazon", "L", null, 50, result);
    expect(await store.pulls.latest("amazon", "L", 3, "2000")).toBeNull();
    expect((await store.pulls.latest("amazon", "L", null, "2000"))?.result).toEqual(result);
  });

  it("scopes judgements, and deletes only the caller's", async () => {
    const own = await store.addJudgement("w1", { kind: "source_rule", text: "no listicles", rejects_kinds: ["seo_listicle"] });
    expect(await store.deleteJudgement(Scope.of("w2"), own.id)).toBe(false);
    await store.bumpJudgement(own.id, 2);
    expect((await store.listJudgements(Scope.of("w1")))[0]).toMatchObject({ applied_count: 2, active: true });
    expect(await store.deleteJudgement(Scope.of("w1"), own.id)).toBe(true);
  });

  it("seeds the first admin once, and ends sessions on a password change", async () => {
    expect(await store.accounts.seedAdmin("ash", "h1")).toBe(true);
    expect(await store.accounts.seedAdmin("ash", "h2")).toBe(false);
    const before = (await store.accounts.byUsername("ash"))!;
    expect(await store.accounts.setPassword("ash", "h3")).toBe(true);
    expect((await store.accounts.byUsername("ash"))!.token_version).toBe(before.token_version + 1);
    expect(await store.accounts.list()).toMatchObject([{ username: "ash", is_admin: true, disabled: false }]);
  });

  it("upserts a target's listing", async () => {
    const { id } = await run();
    const row = { source_run_id: id, target_id: "c1", query: "q", strategy: "s", listing: null, matches: false, mismatch: "", error: "", fetched_at: "t" };
    await store.listings.save(row);
    await store.listings.save({ ...row, error: "again" });
    expect(await store.listings.list(id)).toEqual([{ ...row, error: "again" }]);
  });
});

describe("PostgresDialect", () => {
  it("numbers each parameter and leaves a ? inside a quoted string alone", () => {
    expect(PostgresDialect.statement("SELECT '?', 'it''s ?' FROM t WHERE a = ? AND b = ?")).toBe("SELECT '?', 'it''s ?' FROM t WHERE a = $1 AND b = $2");
  });

  it("makes an autoincrement key an identity, and a REAL an eight-byte float", () => {
    expect(PostgresDialect.script("id INTEGER PRIMARY KEY AUTOINCREMENT, usd REAL")).toBe("id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, usd DOUBLE PRECISION");
  });
});
