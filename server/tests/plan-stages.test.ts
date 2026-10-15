/**
 * A plan past stage 1 (the inbox's plans, decided 2026-10-15): its stage-1 tasks combined into
 * one stage-1 run that later stages read, product truth started on it when ticked, and review
 * mining behind an approval card. The stage runs themselves are a fake `start`: nothing here
 * calls a model or a paid service.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SqlResearchStore } from "../src/adapters/index.js";
import { LiveRuns, PlanStages, RunFindings, StageOneHandoff, TaskEvents } from "../src/agent/index.js";
import { SavedPlans, Scope, type Brief, type Plan, type RunRequest } from "../src/domain/index.js";
import { productPacket } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

let dir: string;
let store: SqlResearchStore;
let runs: LiveRuns;
let started: RunRequest[];
let stages: PlanStages;

const URL_BRIEF: Brief = { product: "", url: "https://magnacalm.example/products/glycinate-400", market: "UK", notes: "" };
const GENRE_BRIEF: Brief = { product: "MagnaCalm 400mg", url: "", market: "UK", notes: "" };

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-stages-"));
  store = await SqliteStores.open(join(dir, "research.db"));
  runs = new LiveRuns(store);
  started = [];
  const start = async (request: RunRequest, workspaceId: string) => {
    started.push(request);
    return (await store.createRun({ workspaceId, brief: request.brief as unknown as Record<string, unknown>, model: "m", rejectKinds: [], judgementIds: [], nodes: request.nodes, stage: request.nodes.includes("review_mining") ? 3 : 2 })).id;
  };
  stages = new PlanStages({ store, runs, start, reviewsPerBand: 50, reuseDays: 183 }, new TaskEvents());
});

afterEach(async () => {
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A finished task run of one stage-1 role, with the rows a packet holds, as a plan's task. */
async function taskRun(brief: Brief, role: "product" | "champion", packet: Record<string, any>): Promise<string> {
  const runId = (await store.createRun({ workspaceId: "admin", brief: brief as never, model: "m", rejectKinds: [], judgementIds: [], nodes: role === "product" ? ["product_data"] : [], contract: { objective: role } })).id;
  const findings = new RunFindings(store.findings, runId, role, ["product_data"]);
  if (packet.competitor_reference) await findings.record("competitor_reference", packet.competitor_reference);
  for (const [kind, section] of [["source", "sources"], ["attribute", "attributes"], ["node_status", "nodes"], ["gap", "gaps"]] as const) {
    for (const item of packet[section] ?? []) await findings.record(kind, item);
  }
  await store.updateRun(runId, { status: "completed" });
  return runId;
}

async function approvedPlan(brief: Brief, tasks: Record<string, string>, ticked: (2 | 3)[]): Promise<Plan> {
  const plan = await store.plans.create("admin", brief, SavedPlans.tasks(brief), SavedPlans.stages());
  return store.plans.save({
    ...plan,
    status: "approved",
    tasks: plan.tasks.map((t) => ({ ...t, selected: t.key in tasks, run_id: tasks[t.key] ?? "" })),
    stages: plan.stages.map((s) => ({ ...s, selected: ticked.includes(s.stage) })),
  });
}

const plan = async (id: string) => (await store.plans.get(Scope.everything, id))!;

describe("a plan's later stages", () => {
  it("combine the plan's stage-1 tasks into one stage-1 run, which product truth then builds on", async () => {
    const task = await taskRun(URL_BRIEF, "product", productPacket());
    const approved = await approvedPlan(URL_BRIEF, { product_facts: task }, [2]);
    await stages.recover();
    const after = await plan(approved.id);
    const combined = (await store.getRun(after.stage_one_run_id))!;
    expect(combined).toMatchObject({ stage: 1, contract: null, status: "completed" });
    expect((combined.packet as any).attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
    expect((await new StageOneHandoff(store).forBrief(URL_BRIEF, Scope.of("admin")))!.run.id).toBe(combined.id);
    expect(started.map((r) => r.nodes)).toEqual([["mechanism", "dose_vs_study", "claim_limits", "cogs_refills"]]);
    expect(after.stages.find((s) => s.stage === 2)!.run_id).not.toBe("");
    await stages.recover();
    expect(started).toHaveLength(1);
  });

  it("never hands a task's own run to a later stage, so stage 2 cannot build on one part of stage 1", async () => {
    await taskRun(URL_BRIEF, "product", productPacket());
    expect(await new StageOneHandoff(store).forBrief(URL_BRIEF, Scope.of("admin"))).toBeNull();
  });

  it("asks the owner before review mining, with what it would spend at most, and starts it only on approval", async () => {
    const champion = await taskRun(GENRE_BRIEF, "champion", { competitor_reference: { name: "MagnaCalm Glycinate", form: "capsule", actives: ["magnesium glycinate"], icp: "adults", source_id: "sha256:aaa" }, sources: [productPacket().sources[0]] });
    const product = await taskRun(GENRE_BRIEF, "product", productPacket());
    const approved = await approvedPlan(GENRE_BRIEF, { champion, product_facts: product }, [2, 3]);
    await stages.recover();
    const truth = (await plan(approved.id)).stages.find((s) => s.stage === 2)!.run_id;
    await store.updateRun(truth, { status: "completed" });
    runs.emit(truth, "run.completed", {});
    await runs.written(truth);
    const card = (await store.cards.list(Scope.of("admin"), 10)).find((c) => c.action.kind === "start_stage")!;
    expect(card.title).toBe("Approve review mining?");
    expect(card.body).toMatch(/At most about \$\d+\.\d\d, before reuse: a stored pull .* younger than 183 days is reused/);
    expect((await plan(approved.id)).stages.find((s) => s.stage === 3)).toMatchObject({ run_id: "", error: PlanStages.WAITING });
    expect(started).toHaveLength(1);
    await stages.decide(approved.id, true);
    expect(started.map((r) => r.nodes).at(-1)).toEqual(["review_mining"]);
    expect((await plan(approved.id)).stages.find((s) => s.stage === 3)!.run_id).not.toBe("");
  });

  it("waits while a task of the plan still runs or waits for its approval card", async () => {
    const task = await taskRun(URL_BRIEF, "product", productPacket());
    await store.updateRun(task, { status: "running" });
    const approved = await approvedPlan(URL_BRIEF, { product_facts: task }, [2]);
    await stages.recover();
    expect((await plan(approved.id)).stage_one_run_id).toBe("");
    expect(started).toEqual([]);
  });
});
