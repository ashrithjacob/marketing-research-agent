/**
 * One ending for every run: whatever its agents recorded is shown, however the
 * run ended. Each test here is an ending that used to lose the ledger.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type MutableModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteResearchStore } from "../src/adapters/index.js";
import { LiveRuns, RunEnd, RunSupervisor, RunWrapUp, StageOneRunAssembly, type RunAssembly } from "../src/agent/index.js";
import { RunFindings } from "../src/agent/run-findings.js";
import { Env, type Settings } from "../src/config/index.js";
import { Findings, runRequestSchema, type Brief } from "../src/domain/index.js";
import { productPacket, recordCalls } from "./fixtures.js";

const MODEL_ID = "faux-model";
const brief: Brief = { product: "MagnaCalm 400mg", url: "https://magnacalm.example/products/glycinate-400", market: "UK", notes: "" };

let dir: string;
let store: SqliteResearchStore;
let settings: Settings;
let models: MutableModels;
let faux: ReturnType<typeof fauxProvider>;
let supervisor: RunSupervisor;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-run-end-"));
  store = new SqliteResearchStore(join(dir, "research.db"));
  settings = { ...Env.settings(), model: MODEL_ID, corpusPath: join(dir, "corpus") };
  faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  models = createModels();
  models.setProvider(faux.provider);
  supervisor = new RunSupervisor({ store, settings, models, retry: { attempts: 1, baseMs: 0, capMs: 0 } });
});

afterEach(async () => {
  await supervisor.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A product_data run whose product agent has recorded a finishable part, left in `status`. */
function runWithRows(status: string): string {
  const runId = store.createRun({ workspaceId: "admin", brief, model: MODEL_ID, rejectKinds: [], judgementIds: [], nodes: ["product_data"] }).id;
  const product = new RunFindings(store.findings, runId, "product", ["product_data"]);
  const packet = productPacket();
  for (const [kind, section] of [["source", "sources"], ["attribute", "attributes"], ["node_status", "nodes"], ["gap", "gaps"]] as const) {
    for (const item of packet[section]) product.record(kind, item);
  }
  store.updateRun(runId, { status });
  return runId;
}

function assembly(runId: string): StageOneRunAssembly {
  return new StageOneRunAssembly(store.findings, runId, { brief, nodes: ["product_data"] }, () => []);
}

describe("a run killed by a restart", () => {
  it("ends failed and shows the packet its rows make", () => {
    const runId = runWithRows("running");
    supervisor.recoverRunsKilledByRestart();
    const run = store.getRun(runId)!;
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/restarted/);
    expect((run.packet as any).attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
    expect(run.packet_source).toBe("ledger");
  });
});

describe("a stopped run", () => {
  it("ends cancelled and keeps the packet of what was recorded before the stop", async () => {
    faux.setResponses([
      fauxAssistantMessage(recordCalls(productPacket()), { stopReason: "toolUse" }),
      () => {
        supervisor.stop(runId);
        return fauxAssistantMessage("", { stopReason: "error", errorMessage: "aborted" });
      },
    ]);
    const runId = supervisor.start(runRequestSchema.parse({ brief, nodes: ["product_data"] }), "admin");
    await supervisor.waitFor(runId);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("cancelled");
    expect((run.packet as any).attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
  });
});

describe("a run whose agent team throws", () => {
  it("ends failed with the error, and the packet is still stored", () => {
    const runId = runWithRows("running");
    const status = new RunEnd(store, new LiveRuns(store)).end(assembly(runId), { kind: "crashed", error: "agent failed: boom" });
    expect(status).toBe("failed");
    const run = store.getRun(runId)!;
    expect(run.error).toBe("agent failed: boom");
    expect(run.packet).not.toBeNull();
  });

  it("ends failed, not stuck, when assembling the ledger itself throws", () => {
    const runId = runWithRows("running");
    const broken: RunAssembly = { runId, via: "ledger", assemble: () => { throw new Error("disk gone"); } };
    expect(new RunEnd(store, new LiveRuns(store)).end(broken, { kind: "settled" })).toBe("failed");
    expect(store.getRun(runId)!.error).toBe("settling failed: disk gone");
  });
});

describe("a ledger with one row that does not parse", () => {
  it("retracts that row into a gap naming it and shows the rest", () => {
    const runId = runWithRows("running");
    const bad = store.findings.append({
      run_id: runId, kind: "attribute", entity: "product", agent_id: "product", source_id: "",
      payload: { node: "product_data", key: "price", value: { not: "a string" }, source_id: productPacket().sources[0].id },
    });
    const assembled = assembly(runId).assemble();
    expect(assembled.retracted).toEqual([bad.id]);
    expect((assembled.packet as any).attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
    const gaps = Findings.live(store.findings.list(runId)).filter((row) => row.kind === "gap").map((row) => String(row.payload.missing));
    expect(gaps.some((gap) => gap.startsWith(`attribute ${bad.id} retracted`))).toBe(true);
  });

  it("returns no packet only for an empty ledger", () => {
    const runId = store.createRun({ workspaceId: "admin", brief, model: MODEL_ID, rejectKinds: [], judgementIds: [], nodes: ["product_data"] }).id;
    expect(assembly(runId).assemble().packet).toBeNull();
  });
});

describe("work after the ending", () => {
  it("cannot turn a completed run into a failed one", async () => {
    const runId = runWithRows("running");
    const runs = new LiveRuns(store);
    expect(new RunEnd(store, runs).end(assembly(runId), { kind: "settled" })).toBe("completed");
    const throwing = { get available(): boolean { throw new Error("listing lookup broke"); } };
    await new RunWrapUp(store, runs, runId, throwing as any).lookUpListings(["competitors"]);
    expect(store.getRun(runId)!.status).toBe("completed");
    expect(store.listEvents(runId).find((e) => e.kind === "packet.listings")!.payload).toEqual({ error: "listing lookup broke" });
  });
});
