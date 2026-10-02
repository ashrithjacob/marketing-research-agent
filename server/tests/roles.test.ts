/**
 * The roles. Every research agent is one RoleSpec; what it may write is derived
 * from what it must deliver, never listed beside it.
 */
import { describe, expect, it } from "vitest";

import { ROLES, RoleRecords, Roles, STAGE_NODES, StageOnePlans } from "../src/domain/index.js";

describe("what each role may write", () => {
  it("is derived from its deliverable and equals the lists the two spec tables held", () => {
    // STAGE_ONE_AGENT_SPECS and PRODUCT_TRUTH_AGENT_SPECS, as they stood before ROLES replaced them.
    const before: Record<string, string[]> = {
      champion: ["source", "competitor_reference", "gap"],
      product: ["source", "attribute", "node_status", "gap"],
      competitors: ["source", "competitor", "saturation", "node_status", "gap"],
      category: ["source", "measurement", "attribute", "node_status", "gap"],
      formula: ["source", "active", "regimen", "gap"],
      mechanism: ["source", "mechanism", "gap"],
      dose_vs_study: ["source", "dose_study", "gap"],
      claim_limits: ["source", "claim_limit", "gap"],
      cogs_refills: ["source", "price_point", "gap"],
    };
    for (const role of ROLES) expect(RoleRecords.of(role), role.id).toEqual(before[role.id]);
  });
});

describe("how roles wait and file", () => {
  it("starts each stage-2 role after the one it reads, as the old `after` lists did", () => {
    expect(Object.fromEntries(ROLES.filter((role) => role.stage === 2).map((role) => [role.id, role.waitsFor]))).toEqual({
      formula: [],
      mechanism: ["formula"],
      dose_vs_study: ["formula"],
      claim_limits: ["dose_vs_study"],
      cogs_refills: ["mechanism"],
    });
  });

  it("gives wait_for to the stage-1 node roles only", () => {
    expect(ROLES.filter((role) => role.tools.includes("wait_for")).map((role) => role.id)).toEqual(["product", "competitors", "category"]);
  });

  it("files the champion under competitors when in scope, and lets a stage-2 role write under every stage-2 node", () => {
    expect(StageOnePlans.nodeOf("champion", ["product_data", "competitors"])).toBe("competitors");
    expect(StageOnePlans.nodeOf("champion", ["category_data"])).toBe("category_data");
    expect(Roles.scope(Roles.of("formula"), STAGE_NODES[2])).toEqual([...STAGE_NODES[2]]);
    expect(Roles.scope(Roles.of("product"), STAGE_NODES[1])).toEqual(["product_data"]);
  });
});
