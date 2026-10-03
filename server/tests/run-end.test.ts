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

import { SqlResearchStore } from "../src/adapters/index.js";
import { LiveRuns, RunEnd, RunSupervisor, RunWrapUp, StageOneRunAssembly, type RunAssembly } from "../src/agent/index.js";
import { RunFindings } from "../src/agent/run-findings.js";
import { Env, type Settings } from "../src/config/index.js";
import { Findings, runRequestSchema, type Brief } from "../src/domain/index.js";
import { productPacket, recordCalls } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

const MODEL_ID = "faux-model";
const brief: Brief = { product: "MagnaCalm 400mg", url: "https://magnacalm.example/products/glycinate-400", market: "UK", notes: "" };

let dir: string;
let store: SqlResearchStore;
let settings: Settings;
let models: MutableModels;
let faux: ReturnType<typeof fauxProvider>;
let supervisor: RunSupervisor;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-run-end-"));
  store = await SqliteStores.open(join(dir, "research.db"));
  settings = { ...Env.settings(), model: MODEL_ID, corpusPath: join(dir, "corpus") };
  faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  models = createModels();
  models.setProvider(faux.provider);
  supervisor = new RunSupervisor({ store, settings, models, retry: { attempts: 1, baseMs: 0, capMs: 0 } });
});

afterEach(async () => {
  await supervisor.close();
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A product_data run whose product agent has recorded a finishable part, left in `status`. */
async function runWithRows(status: string): Promise<string> {
  const runId = (await store.createRun({ workspaceId: "admin", brief, model: MODEL_ID, rejectKinds: [], judgementIds: [], nodes: ["product_data"] })).id;
  const product = new RunFindings(store.findings, runId, "product", ["product_data"]);
  const packet = productPacket();
  for (const [kind, section] of [["source", "sources"], ["attribute", "attributes"], ["node_status", "nodes"], ["gap", "gaps"]] as const) {
    for (const item of packet[section]) await product.record(kind, item);
  }
  await store.updateRun(runId, { status });
  return runId;
}

function assembly(runId: string): StageOneRunAssembly {
  return new StageOneRunAssembly(store.findings, runId, { brief, nodes: ["product_data"] }, async () => []);
}

describe("a run killed by a restart", () => {
  it("ends failed and shows the packet its rows make", async () => {
    const runId = (await runWithRows("running"));
    await supervisor.recoverRunsKilledByRestart();
    const run = (await store.getRun(runId))!;
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
      async () => {
        await supervisor.stop(runId);
        return fauxAssistantMessage("", { stopReason: "error", errorMessage: "aborted" });
      },
    ]);
    const runId = (await supervisor.start(runRequestSchema.parse({ brief, nodes: ["product_data"] }), "admin"));
    await supervisor.waitFor(runId);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("cancelled");
    expect((run.packet as any).attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
  });
});

describe("a run whose agent team throws", () => {
  it("ends failed with the error, and the packet is still stored", async () => {
    const runId = (await runWithRows("running"));
    const status = (await new RunEnd(store, new LiveRuns(store)).end(assembly(runId), { kind: "crashed", error: "agent failed: boom" }));
    expect(status).toBe("failed");
    const run = (await store.getRun(runId))!;
    expect(run.error).toBe("agent failed: boom");
    expect(run.packet).not.toBeNull();
  });

  it("ends failed, not stuck, when assembling the ledger itself throws", async () => {
    const runId = (await runWithRows("running"));
    const broken: RunAssembly = { runId, via: "ledger", assemble: () => { throw new Error("disk gone"); } };
    expect((await new RunEnd(store, new LiveRuns(store)).end(broken, { kind: "settled" }))).toBe("failed");
    expect((await store.getRun(runId))!.error).toBe("settling failed: disk gone");
  });
});

describe("a ledger with one row that does not parse", () => {
  it("retracts that row into a gap naming it and shows the rest", async () => {
    const runId = (await runWithRows("running"));
    const bad = (await store.findings.append({
      run_id: runId, kind: "attribute", entity: "product", agent_id: "product", source_id: "",
      payload: { node: "product_data", key: "price", value: { not: "a string" }, source_id: productPacket().sources[0].id },
    }));
    const assembled = (await assembly(runId).assemble());
    expect(assembled.retracted).toEqual([bad.id]);
    expect((assembled.packet as any).attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
    const gaps = Findings.live((await store.findings.list(runId))).filter((row) => row.kind === "gap").map((row) => String(row.payload.missing));
    expect(gaps.some((gap) => gap.startsWith(`attribute ${bad.id} retracted`))).toBe(true);
  });

  it("returns no packet only for an empty ledger", async () => {
    const runId = (await store.createRun({ workspaceId: "admin", brief, model: MODEL_ID, rejectKinds: [], judgementIds: [], nodes: ["product_data"] })).id;
    expect((await assembly(runId).assemble()).packet).toBeNull();
  });
});

describe("work after the ending", () => {
  it("cannot turn a completed run into a failed one", async () => {
    const runId = (await runWithRows("running"));
    const runs = new LiveRuns(store);
    expect((await new RunEnd(store, runs).end(assembly(runId), { kind: "settled" }))).toBe("completed");
    const throwing = { get available(): boolean { throw new Error("listing lookup broke"); } };
    await new RunWrapUp(store, runs, runId, throwing as any).lookUpListings(["competitors"]);
    await runs.written(runId);
    expect((await store.getRun(runId))!.status).toBe("completed");
    expect((await store.listEvents(runId)).find((e) => e.kind === "packet.listings")!.payload).toEqual({ error: "listing lookup broke" });
  });
});
