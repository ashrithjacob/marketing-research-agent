import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PRODUCT_DELIVERABLE, Primitives, RoleRecords, SavedPlans, Scope, taskContractSchema, taskRequestSchema, type PlanTask, type FindingKind, type TaskContract } from "../src/domain/index.js";
import { ContractCheck, type ContractGrounds } from "../src/extract/index.js";
import { SqliteDatabase, SqlResearchStore } from "../src/adapters/index.js";
import { SqliteStores } from "./sqlite-stores.js";

export function productContract(overrides: Record<string, unknown> = {}): TaskContract {
  return taskContractSchema.parse({
    objective: "What the product is and what it costs, from its own page",
    primitive: "research",
    complete: PRODUCT_DELIVERABLE,
    budget: { max_usd: 0.5, max_minutes: 20 },
    ...overrides,
  });
}

function grounds(overrides: Partial<ContractGrounds> = {}): ContractGrounds {
  return {
    recordable: new Set<FindingKind>(["source", "attribute", "measurement", "excerpt", "competitor", "competitor_reference", "gap", "saturation", "node_status"]),
    findings: new Set(),
    documents: new Set(),
    maxUsd: 2,
    ...overrides,
  };
}

describe("a task contract", () => {
  it("parses a research contract with the defaults filled in", () => {
    const contract = productContract();
    expect(contract.verify).toBe("code");
    expect(contract.inputs).toEqual({ finding_ids: [], document_ids: [] });
  });

  it("refuses a primitive, a finding kind or a field the vocabulary does not have", () => {
    expect(taskContractSchema.safeParse({ ...productContract(), primitive: "ad_scan" }).success).toBe(false);
    const badKind = { ...PRODUCT_DELIVERABLE, fields: [{ key: "x", record: "opinion", required: true, describe: "x" }] };
    expect(taskContractSchema.safeParse({ ...productContract(), complete: badKind }).success).toBe(false);
    expect(taskContractSchema.safeParse({ ...productContract(), deadline: "tomorrow" }).success).toBe(false);
  });

  it("passes the check when it can be met", () => {
    expect(ContractCheck.problems(productContract(), grounds())).toEqual([]);
  });

  it("refuses a deliverable with no node the primitive files under", () => {
    const contract = productContract({ complete: { ...PRODUCT_DELIVERABLE, node: null } });
    expect(ContractCheck.problems(contract, grounds())).toEqual([
      "a research task files under one of product_data, competitors, category_data; this deliverable's node is none",
    ]);
  });

  it("refuses a kind the primitive cannot record, inputs that do not exist, a budget over the cap, and a verifier with nothing behind it", () => {
    const contract = productContract({
      inputs: { finding_ids: ["run1/a3"], document_ids: ["doc9"] },
      budget: { max_usd: 5, max_minutes: 20 },
      verify: "owner",
    });
    const problems = ContractCheck.problems(contract, grounds({ recordable: new Set<FindingKind>(["source"]) }));
    expect(problems).toEqual([
      "a research task cannot record 'attribute', so a deliverable naming it can never be met",
      "input finding 'run1/a3' is not in this workspace",
      "input document 'doc9' is not in this workspace",
      "budget.max_usd 5 is over the per-task cap of 2",
      "verify 'owner' has nothing to run it for a research task; 'code' is built, and 'critique' for a write",
    ]);
  });

  it("becomes the role spec today's checks read: the primitive's tools and ceiling, the contract's deliverable", () => {
    const role = Primitives.role(productContract());
    expect(role).toMatchObject({ id: "research", tools: ["web_search", "web_fetch"], maxTurns: 30, consistency: "stage_one_node" });
    expect(RoleRecords.of(role)).toEqual(["source", "attribute", "node_status", "gap"]);
  });
});

describe("the example tasks in docs/tasks", () => {
  const folder = new URL("../../docs/tasks/", import.meta.url).pathname;
  it.each(readdirSync(folder).filter((name) => name.endsWith(".json")))("%s parses and passes the contract check", (name) => {
    const request = taskRequestSchema.parse(JSON.parse(readFileSync(join(folder, name), "utf-8")));
    expect(ContractCheck.problems(request.contract, grounds())).toEqual([]);
  });
});

describe("a task's run row", () => {
  let dir = "";
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("keeps its contract, and takes its task and conversation ids", async () => {
    dir = mkdtempSync(join(tmpdir(), "mra-task-run-"));
    const store = await SqliteStores.open(join(dir, "research.db"));
    const contract = productContract();
    const run = await store.createRun({
      workspaceId: "admin",
      brief: { product: "", url: "https://example.com", market: "", notes: "" },
      model: "m",
      rejectKinds: [],
      judgementIds: [],
      nodes: ["product_data"],
      contract: contract as unknown as Record<string, unknown>,
    });
    expect(run).toMatchObject({ task_id: "", conversation_id: "", contract });
    await store.updateRun(run.id, { task_id: "t1", conversation_id: "c1" });
    expect(await store.getRun(run.id)).toMatchObject({ task_id: "t1", conversation_id: "c1" });
    await store.close();
  });
});

describe("stage 1 as a saved plan", () => {
  const keys = (tasks: PlanTask[]) => tasks.map((t) => [t.key, t.selected, t.after.join(",")]);
  const site = { product: "", url: "https://brand.example", market: "", notes: "" };

  it("keeps the champion for a site only while competitors are kept, and starts the others after it", () => {
    const plan = SavedPlans.tasks(site);
    expect(keys(plan)).toEqual([
      ["champion", true, ""],
      ["product_facts", true, "champion"],
      ["competitors", true, "champion"],
      ["category_numbers", true, "champion"],
    ]);
    const without = SavedPlans.arrange(site, plan.map((t) => (t.key === "competitors" ? { ...t, selected: false } : t)));
    expect(keys(without)).toEqual([
      ["champion", false, ""],
      ["product_facts", true, ""],
      ["competitors", false, ""],
      ["category_numbers", true, ""],
    ]);
  });

  it("always keeps the champion for a product name, which only the champion turns into a product", () => {
    const genre = { product: "magnesium glycinate", url: "", market: "", notes: "" };
    const plan = SavedPlans.arrange(genre, SavedPlans.tasks(genre).map((t) => (t.key === "competitors" ? { ...t, selected: false } : t)));
    expect(plan.find((t) => t.key === "champion")!.selected).toBe(true);
    expect(plan.find((t) => t.key === "product_facts")!.after).toEqual(["champion"]);
  });

  it("works each task as its stage-1 role, and asks first for the ones that can reach Apify", () => {
    const plan = SavedPlans.tasks(site);
    expect(plan.map((t) => Primitives.role(t.contract).id)).toEqual(["champion", "product", "competitors", "category"]);
    expect(plan.map((t) => ContractCheck.asksFirst(t.contract).length > 0)).toEqual([true, false, true, false]);
    expect(plan.map((t) => ContractCheck.problems(t.contract, grounds()))).toEqual([[], [], [], []]);
  });
});

describe("a plan saved by an older build", () => {
  let dir = "";
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reads with the fields added since filled in, so startup does not trip on it", async () => {
    dir = mkdtempSync(join(tmpdir(), "mra-old-plan-"));
    const db = SqliteDatabase.open(join(dir, "research.db"));
    const store = await SqlResearchStore.open(db);
    const old = [{ key: "product_facts", title: "Product facts", contract: productContract(), selected: true, run_id: "", error: "" }];
    await db.run("INSERT INTO research_plans (id, workspace_id, brief, tasks, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)", [
      "p1", "admin", JSON.stringify({ url: "https://x.example" }), JSON.stringify(old), "approved", "2026-10-14T00:00:00Z", "2026-10-14T00:00:00Z",
    ]);
    const [plan] = await store.plans.list(Scope.everything, 5);
    expect(plan!.tasks[0]).toMatchObject({ key: "product_facts", auto: false, after: [] });
    await store.close();
  });
});
