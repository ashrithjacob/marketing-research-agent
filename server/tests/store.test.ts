/** Persistence: the run row, the replayable event log, and the migration. */
import { Scope } from "../src/domain/index.js";

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  Runs,
} from "../src/domain/index.js";
import { SqliteResearchStore } from "../src/adapters/index.js";
import { minimalPacket } from "./fixtures.js";

let dir: string;
let store: SqliteResearchStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-store-"));
  store = new SqliteResearchStore(join(dir, "research.db"));
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const newRun = () =>
  store.createRun({ workspaceId: "admin", brief: { product: "x" }, model: "m", rejectKinds: [], judgementIds: [] });

describe("runs", () => {
  it("moves through its lifecycle", () => {
    const run = newRun();
    expect(run.status).toBe("queued");
    store.updateRun(run.id, { status: "running" });
    expect(store.getRun(run.id)?.status).toBe("running");
  });

  it("refuses to write a column that does not exist", () => {
    const run = newRun();
    expect(() => store.updateRun(run.id, { nonsense: 1 } as any)).toThrow(/not run columns/);
  });

  it("stores the packet as JSON", () => {
    const run = newRun();
    store.updateRun(run.id, { packet: minimalPacket() });
    expect((store.getRun(run.id)?.packet as any).brief.product).toBe("MagnaCalm 400mg");
  });

  it("counts admitted and rejected sources separately", () => {
    const run = newRun();
    const packet = minimalPacket();
    packet.sources.push({
      id: "sha256:ddd",
      url: "https://x",
      kind: "seo_listicle",
      admitted: false,
      node: "competitors",
    });
    store.updateRun(run.id, { packet });
    const counts = Runs.summary(store.getRun(run.id)!).counts;
    expect(counts.sources).toBe(1);
    expect(counts.rejected).toBe(1);
  });
});

describe("events", () => {
  it("replays in order and honours `after`", () => {
    const run = newRun();
    const first = store.addEvent(run.id, "run.started", {});
    store.addEvent(run.id, "tool.started", { tool: "web_search" });
    const all = store.listEvents(run.id);
    expect(all.map((e) => e.kind)).toEqual(["run.started", "tool.started"]);
    expect(store.listEvents(run.id, first.id).map((e) => e.kind)).toEqual(["tool.started"]);
  });
});

describe("judgements", () => {
  it("counts applications rather than claiming them", () => {
    const judgement = store.addJudgement("admin", { kind: "source_rule", text: "no listicles", rejects_kinds: [] });
    expect(judgement.applied_count).toBe(0);
    store.bumpJudgement(judgement.id, 3);
    expect(store.listJudgements(Scope.everything)[0]!.applied_count).toBe(3);
  });

  it("lists only active judgements when asked", () => {
    store.addJudgement("admin", { kind: "custom", text: "one", rejects_kinds: [] });
    expect(store.listJudgements(Scope.everything, true)).toHaveLength(1);
  });
});

describe("migration", () => {
  it("adds columns to a database an older version created", () => {
    // `CREATE TABLE IF NOT EXISTS` is a no-op against an existing table, so a
    // column added later has to arrive through the migration or the first
    // INSERT fails — at INSERT, not at startup, which is the trap.
    const path = join(dir, "old.db");
    const old = new Database(path);
    old.exec(`
      CREATE TABLE research_runs (
        id TEXT PRIMARY KEY, hermes_run_id TEXT NOT NULL DEFAULT '',
        session_id TEXT NOT NULL DEFAULT '', stage INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL, model TEXT NOT NULL DEFAULT '',
        brief TEXT NOT NULL DEFAULT '{}', reject_kinds TEXT NOT NULL DEFAULT '[]',
        packet TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        ended_at TEXT NOT NULL DEFAULT ''
      );
    `);
    old.close();

    const migrated = new SqliteResearchStore(path);
    try {
      const run = migrated.createRun({
        workspaceId: "admin",
        brief: { product: "x" },
        model: "m",
        rejectKinds: [],
        judgementIds: ["j1"],
        nodes: ["product_data"],
      });
      migrated.updateRun(run.id, { output: "text", usage: { totalTokens: 1 }, agent_run_id: "a" });
      const back = migrated.getRun(run.id)!;
      expect(back.output).toBe("text");
      expect(back.judgement_ids).toEqual(["j1"]);
      expect(back.agent_run_id).toBe("a");
      expect(back.nodes).toEqual(["product_data"]);
    } finally {
      migrated.close();
    }
  });

  it("reads a run from before per-node runs as covering the whole stage", () => {
    // Its `nodes` column arrives as `[]`, and every such run did all four.
    const run = newRun();
    expect(store.getRun(run.id)!.nodes).toEqual([]);
    expect(Runs.summary(store.getRun(run.id)!).nodes).toEqual([
      "product_data",
      "competitors",
      "category_data",
    ]);
  });
});

describe("stage-2 runs and their stage-1 run", () => {
  it("backfills each old stage-2 run with the stage-1 run it mined, never a later one", () => {
    const path = join(dir, "before-source-run.db");
    const first = new SqliteResearchStore(path);
    const brief = { product: "", url: "https://mullevia.com/p" };
    const run = (stage: number, at: string) => {
      const r = first.createRun({ workspaceId: "admin", brief, model: "m", rejectKinds: [], judgementIds: [], stage });
      first.updateRun(r.id, { status: "completed" });
      return { id: r.id, at };
    };
    const older = run(1, "2026-09-29T10:00:00.000Z");
    const mining = run(2, "2026-09-29T11:00:00.000Z");
    const newer = run(1, "2026-09-30T10:00:00.000Z");
    first.close();
    const raw = new Database(path);
    for (const r of [older, mining, newer]) raw.prepare("UPDATE research_runs SET created_at = ? WHERE id = ?").run(r.at, r.id);
    raw.exec("ALTER TABLE research_runs DROP COLUMN source_run_id");
    raw.close();

    const migrated = new SqliteResearchStore(path);
    try {
      expect(migrated.getRun(mining.id)!.source_run_id).toBe(older.id);
      expect(migrated.getRun(newer.id)!.source_run_id).toBe("");
    } finally {
      migrated.close();
    }
  });
});

describe("llm calls", () => {
  const call = (runId: string, seq: number, responseId: string) => ({
    run_id: runId,
    seq,
    agent_id: seq === 1 ? "champion" : "product",
    started_at: "2026-09-18T10:00:00.000Z",
    ended_at: "2026-09-18T10:00:02.000Z",
    duration_ms: 2000,
    model: "m",
    system_prompt: seq === 1 ? "you are the researcher" : null,
    tools: seq === 1 ? [{ name: "web_search" }] : null,
    context_reset: false,
    context_messages: seq,
    input: [{ role: "user", content: `turn ${seq}` }],
    output: { content: [{ type: "text", text: "answer" }] },
    stop_reason: "stop",
    error: "",
    usage: { input: 10, output: 5 },
    response_id: responseId,
  });

  it("adds the generation and agent_id columns to a call log that predates them", () => {
    const path = join(dir, "calls-before-generation.db");
    const old = new Database(path);
    old.exec(`
      CREATE TABLE research_llm_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, seq INTEGER NOT NULL,
        started_at TEXT NOT NULL, ended_at TEXT NOT NULL, duration_ms INTEGER NOT NULL,
        model TEXT NOT NULL DEFAULT '', system_prompt TEXT, tools TEXT,
        context_reset INTEGER NOT NULL DEFAULT 0, context_messages INTEGER NOT NULL DEFAULT 0,
        input TEXT NOT NULL DEFAULT '[]', output TEXT NOT NULL DEFAULT '{}',
        stop_reason TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '',
        usage TEXT NOT NULL DEFAULT '{}', response_id TEXT NOT NULL DEFAULT '', billed_cost REAL
      );
    `);
    old.close();

    const migrated = new SqliteResearchStore(path);
    try {
      const run = migrated.createRun({
        workspaceId: "admin",
        brief: { product: "x" },
        model: "m",
        rejectKinds: [],
        judgementIds: [],
        nodes: ["product_data"],
      });
      migrated.addLlmCall(call(run.id, 1, "gen-1"));
      migrated.setLlmCallGeneration(run.id, "gen-1", {
        model: "z-ai/glm-5.3-flash",
        cost: 0.01,
        latency_ms: 949,
        generation_ms: 38233,
        reasoning_tokens: 2015,
        provider: "Parasail",
      });
      expect(migrated.listLlmCalls(run.id)[0]!.generation?.latency_ms).toBe(949);
      expect(migrated.listLlmCalls(run.id)[0]!.agent_id).toBe("champion");
    } finally {
      migrated.close();
    }
  });

  it("round-trips in order, keeping null where the prompt did not change", () => {
    const run = newRun();
    store.addLlmCall(call(run.id, 2, "gen-2"));
    store.addLlmCall(call(run.id, 1, "gen-1"));
    const calls = store.listLlmCalls(run.id);
    expect(calls.map((c) => c.seq)).toEqual([1, 2]);
    expect(calls.map((c) => c.agent_id)).toEqual(["champion", "product"]);
    expect(calls[0]!.system_prompt).toBe("you are the researcher");
    expect(calls[0]!.tools).toEqual([{ name: "web_search" }]);
    expect(calls[1]!.system_prompt).toBeNull();
    expect(calls[1]!.tools).toBeNull();
    expect(calls[1]!.input).toEqual([{ role: "user", content: "turn 2" }]);
    expect(calls[0]!.billed_cost).toBeNull();
  });

  it("attaches a generation record, and its billed cost, to the call it belongs to", () => {
    const run = newRun();
    store.addLlmCall(call(run.id, 1, "gen-1"));
    store.addLlmCall(call(run.id, 2, "gen-2"));
    const generation = {
      model: "z-ai/glm-5.3-flash",
      cost: 0.0042,
      latency_ms: 949,
      generation_ms: 38233,
      reasoning_tokens: 2015,
      provider: "Parasail",
    };
    store.setLlmCallGeneration(run.id, "gen-2", generation);
    const [first, second] = store.listLlmCalls(run.id);
    expect(first!.billed_cost).toBeNull();
    expect(first!.generation).toBeNull();
    expect(second!.billed_cost).toBeCloseTo(0.0042, 10);
    expect(second!.generation).toEqual(generation);
  });
});

describe("the review corpus", () => {
  const snapshot = (text: string) => ({
    pulls: [
      {
        handle: "p1",
        source_id: "sha256:abc",
        target_id: "product",
        platform: "amazon" as const,
        listing: "https://www.amazon.com/dp/B0H2JVQ9GR",
        band_requested: 3,
        fetched_at: "2026-09-25T12:00:00Z",
        archived: true,
        total_reviews: null,
        total_ratings: null,
        gap: null,
      },
    ],
    reviews: [
      {
        ref: "r1.1",
        pull: "p1",
        platform: "amazon" as const,
        review_key: "R1",
        listing: "https://www.amazon.com/dp/B0H2JVQ9GR",
        star: 3,
        title: "t",
        text,
        posted_at: "2026-08-01",
        verified: true,
        locator: "https://www.amazon.com/gp/customer-reviews/R1",
      },
    ],
  });

  it("keeps a review once however many runs fetch it, and links it to each run", () => {
    const first = newRun();
    const second = newRun();
    store.saveRunReviews(first.id, snapshot("works"));
    store.saveRunReviews(second.id, snapshot("works"));

    const db = new Database(join(dir, "research.db"));
    const count = (db.prepare("SELECT COUNT(*) AS n FROM research_reviews").get() as { n: number }).n;
    db.close();
    expect(count).toBe(1);

    for (const run of [first, second]) {
      expect(store.listRunReviews(run.id)[0]).toMatchObject({
        ref: "r1.1",
        source_id: "sha256:abc",
        target_id: "product",
        text: "works",
        star: 3,
      });
    }
  });
});

describe("the run ledger", () => {
  const newRun = () =>
    store.createRun({ workspaceId: "admin", brief: { product: "x" }, model: "m", rejectKinds: [], judgementIds: [] });
  const draft = (runId: string, kind: "gap" | "source", payload: Record<string, unknown>) => ({
    run_id: runId, kind, entity: "product", agent_id: "parent", source_id: "", payload,
  });

  it("numbers rows per run and names each by its kind", () => {
    const a = newRun();
    const b = newRun();
    expect(store.findings.append(draft(a.id, "gap", { missing: "x" })).id).toBe("gap1");
    expect(store.findings.append(draft(a.id, "source", { id: "sha256:a" })).id).toBe("src2");
    expect(store.findings.append(draft(b.id, "gap", { missing: "y" })).id).toBe("gap1");
    expect(store.findings.list(a.id).map((row) => row.seq)).toEqual([1, 2]);
  });

  it("retracts a row once, keeping it with its reason", () => {
    const run = newRun();
    store.findings.append(draft(run.id, "gap", { missing: "x" }));
    expect(store.findings.retract(run.id, "gap1", "found it")?.retracted_why).toBe("found it");
    expect(store.findings.retract(run.id, "gap1", "again")).toBeNull();
    expect(store.findings.list(run.id)).toHaveLength(1);
  });

  it("keeps what was found through a restart, because each row is written as it is found", () => {
    const run = newRun();
    store.findings.append(draft(run.id, "gap", { missing: "no COA" }));
    store.close();
    store = new SqliteResearchStore(join(dir, "research.db"));
    expect(store.findings.list(run.id).map((row) => row.payload)).toEqual([{ missing: "no COA" }]);
  });
});
