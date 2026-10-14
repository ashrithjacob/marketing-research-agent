import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PRODUCT_DELIVERABLE, Primitives, RoleRecords, taskContractSchema, taskRequestSchema, type FindingKind, type TaskContract } from "../src/domain/index.js";
import { ContractCheck, type ContractGrounds } from "../src/extract/index.js";
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
    recordable: new Set<FindingKind>(["source", "attribute", "measurement", "excerpt", "competitor", "gap", "saturation", "node_status"]),
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
    expect(taskContractSchema.safeParse({ ...productContract(), primitive: "write" }).success).toBe(false);
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
      "verify 'owner' has nothing to run it yet; only 'code' is built",
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
