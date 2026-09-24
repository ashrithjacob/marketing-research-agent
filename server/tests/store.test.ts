/** Persistence: the run row, the replayable event log, and the migration. */

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
  store.createRun({ brief: { product: "x" }, model: "m", rejectKinds: [], judgementIds: [] });

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

describe("the review ledger", () => {
  const excerpt = (locator: string, text = "kept") => ({
    text,
    star: 3,
    date: "2026-09-01",
    locator,
    title: "",
    verified: false,
  });

  it("remembers excerpts across store instances, keyed by band and locator", () => {
    const path = join(dir, "ledger.db");
    const first = new SqliteResearchStore(path);
    first.reviewLedger().record("amazon|3|https://amazon.example/dp/B1", "run-1", [excerpt("l1")]);
    first.reviewLedger().record("amazon|3|https://amazon.example/dp/B1", "run-2", [excerpt("l1"), excerpt("l2")]);
    first.close();

    const second = new SqliteResearchStore(path);
    try {
      const rows = second.reviewLedger().cached("amazon|3|https://amazon.example/dp/B1", 10);
      expect(rows.map((r) => r.locator)).toEqual(["l2", "l1"]);
      expect(second.reviewLedger().cached("amazon|4|https://amazon.example/dp/B1", 10)).toEqual([]);
      expect(second.reviewLedger().cached("amazon|3|https://amazon.example/dp/B2", 10)).toEqual([]);
      expect(second.reviewLedger().cached("amazon|3|https://amazon.example/dp/B1", 1)).toHaveLength(1);
    } finally {
      second.close();
    }
  });

  it("ignores excerpts without a locator rather than keying them all together", () => {
    store.reviewLedger().record("trustpilot|any|huel.com", "run-1", [excerpt(""), excerpt("")]);
    expect(store.reviewLedger().cached("trustpilot|any|huel.com", 10)).toEqual([]);
  });
});

describe("judgements", () => {
  it("counts applications rather than claiming them", () => {
    const judgement = store.addJudgement({ kind: "source_rule", text: "no listicles", rejects_kinds: [] });
    expect(judgement.applied_count).toBe(0);
    store.bumpJudgement(judgement.id, 3);
    expect(store.listJudgements()[0]!.applied_count).toBe(3);
  });

  it("lists only active judgements when asked", () => {
    store.addJudgement({ kind: "custom", text: "one", rejects_kinds: [] });
    expect(store.listJudgements(true)).toHaveLength(1);
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

describe("llm calls", () => {
  const call = (runId: string, seq: number, responseId: string) => ({
    run_id: runId,
    seq,
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

  it("round-trips in order, keeping null where the prompt did not change", () => {
    const run = newRun();
    store.addLlmCall(call(run.id, 2, "gen-2"));
    store.addLlmCall(call(run.id, 1, "gen-1"));
    const calls = store.listLlmCalls(run.id);
    expect(calls.map((c) => c.seq)).toEqual([1, 2]);
    expect(calls[0]!.system_prompt).toBe("you are the researcher");
    expect(calls[0]!.tools).toEqual([{ name: "web_search" }]);
    expect(calls[1]!.system_prompt).toBeNull();
    expect(calls[1]!.tools).toBeNull();
    expect(calls[1]!.input).toEqual([{ role: "user", content: "turn 2" }]);
    expect(calls[0]!.billed_cost).toBeNull();
  });

  it("attaches a billed cost to the call it was billed for", () => {
    const run = newRun();
    store.addLlmCall(call(run.id, 1, "gen-1"));
    store.addLlmCall(call(run.id, 2, "gen-2"));
    store.setLlmCallBilled(run.id, "gen-2", 0.0042);
    const [first, second] = store.listLlmCalls(run.id);
    expect(first!.billed_cost).toBeNull();
    expect(second!.billed_cost).toBeCloseTo(0.0042, 10);
  });
});
