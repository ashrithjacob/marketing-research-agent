import type { Deliverable } from "./deliverable.js";
import type { Node } from "./nodes.js";
import { BREAKING_POINT_DELIVERABLE, GATE_DELIVERABLE, MARKET_SIZE_DELIVERABLE, OFFERS_DELIVERABLE, SOPHISTICATION_DELIVERABLE } from "./market-deliverables.js";
import type { MarketTruthAgent } from "./market-truth-agents.js";
import type { CustomerTruthAgent } from "./customer-truth-agents.js";
import { AVATARS_DELIVERABLE, AWARENESS_DELIVERABLE, IDENTITY_DELIVERABLE, VOICES_DELIVERABLE } from "./customer-deliverables.js";
import type { ProductTruthAgent } from "./product-truth-agents.js";
import {
  CATEGORY_DELIVERABLE,
  CHAMPION_DELIVERABLE,
  CLAIMS_DELIVERABLE,
  COGS_DELIVERABLE,
  COMPETITORS_DELIVERABLE,
  DOSE_DELIVERABLE,
  FORMULA_DELIVERABLE,
  MECHANISM_DELIVERABLE,
  PRODUCT_DELIVERABLE,
} from "./role-deliverables.js";
import type { StageOneAgent } from "./stage-one-agents.js";
import type { PrimitiveName } from "./task-contract.js";
import { Trace } from "../trace/index.js";

export const TOOL_NAMES = [
  "web_search",
  "web_fetch",
  "evidence_search",
  "evidence_fetch",
  "discover_competitors",
  "ad_library_search",
  "amazon_find_product",
  "library_index",
  "library_read",
  "wait_for",
  "use_source",
  "read_reviews",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const CONSISTENCY_CHECKS = ["stage_one_node", "champion", "product_truth", "market_node", "customer_node"] as const;
export type Consistency = (typeof CONSISTENCY_CHECKS)[number];

export type RoleId = StageOneAgent | ProductTruthAgent | MarketTruthAgent | CustomerTruthAgent | PrimitiveName;

/** Everything that makes one research agent different from another, except its prompt text. */
export interface RoleSpec {
  id: RoleId;
  stage: 1 | 2 | 4 | 5;
  tools: readonly ToolName[];
  deliverable: Deliverable;
  consistency: Consistency;
  maxTurns: number;
  waitsFor: readonly RoleId[];
}

const STAGE_ONE_WEB: readonly ToolName[] = ["web_search", "web_fetch", "library_index", "library_read"];
const EVIDENCE: readonly ToolName[] = ["evidence_search", "evidence_fetch", "library_index", "library_read"];
const MARKET: readonly ToolName[] = ["use_source", "web_search", "web_fetch", "library_index", "library_read"];
const CUSTOMER: readonly ToolName[] = ["read_reviews", "web_search", "web_fetch", "library_index", "library_read"];

export const ROLES: readonly RoleSpec[] = [
  { id: "champion", stage: 1, tools: [...STAGE_ONE_WEB, "amazon_find_product"], deliverable: CHAMPION_DELIVERABLE, consistency: "champion", maxTurns: 10, waitsFor: [] },
  { id: "product", stage: 1, tools: [...STAGE_ONE_WEB, "ad_library_search", "wait_for"], deliverable: PRODUCT_DELIVERABLE, consistency: "stage_one_node", maxTurns: 15, waitsFor: ["champion"] },
  {
    id: "competitors",
    stage: 1,
    tools: [...STAGE_ONE_WEB, "discover_competitors", "ad_library_search", "amazon_find_product", "wait_for"],
    deliverable: COMPETITORS_DELIVERABLE,
    consistency: "stage_one_node",
    maxTurns: 20,
    waitsFor: ["champion"],
  },
  { id: "category", stage: 1, tools: [...STAGE_ONE_WEB, "ad_library_search", "wait_for"], deliverable: CATEGORY_DELIVERABLE, consistency: "stage_one_node", maxTurns: 15, waitsFor: ["champion"] },
  { id: "formula", stage: 2, tools: EVIDENCE, deliverable: FORMULA_DELIVERABLE, consistency: "product_truth", maxTurns: 10, waitsFor: [] },
  { id: "mechanism", stage: 2, tools: EVIDENCE, deliverable: MECHANISM_DELIVERABLE, consistency: "product_truth", maxTurns: 15, waitsFor: ["formula"] },
  { id: "dose_vs_study", stage: 2, tools: EVIDENCE, deliverable: DOSE_DELIVERABLE, consistency: "product_truth", maxTurns: 15, waitsFor: ["formula"] },
  { id: "claim_limits", stage: 2, tools: EVIDENCE, deliverable: CLAIMS_DELIVERABLE, consistency: "product_truth", maxTurns: 20, waitsFor: ["dose_vs_study"] },
  { id: "cogs_refills", stage: 2, tools: EVIDENCE, deliverable: COGS_DELIVERABLE, consistency: "product_truth", maxTurns: 8, waitsFor: ["mechanism"] },
  { id: "market_size", stage: 4, tools: MARKET, deliverable: MARKET_SIZE_DELIVERABLE, consistency: "market_node", maxTurns: 15, waitsFor: [] },
  { id: "offers", stage: 4, tools: [...MARKET, "ad_library_search"], deliverable: OFFERS_DELIVERABLE, consistency: "market_node", maxTurns: 15, waitsFor: [] },
  { id: "sophistication", stage: 4, tools: [...MARKET, "ad_library_search"], deliverable: SOPHISTICATION_DELIVERABLE, consistency: "market_node", maxTurns: 15, waitsFor: [] },
  { id: "breaking_point", stage: 4, tools: MARKET, deliverable: BREAKING_POINT_DELIVERABLE, consistency: "market_node", maxTurns: 15, waitsFor: [] },
  { id: "voices", stage: 5, tools: CUSTOMER, deliverable: VOICES_DELIVERABLE, consistency: "customer_node", maxTurns: 20, waitsFor: [] },
  { id: "identity", stage: 5, tools: CUSTOMER, deliverable: IDENTITY_DELIVERABLE, consistency: "customer_node", maxTurns: 20, waitsFor: [] },
  { id: "avatars", stage: 5, tools: ["read_reviews", "library_index", "library_read"], deliverable: AVATARS_DELIVERABLE, consistency: "customer_node", maxTurns: 15, waitsFor: ["voices", "identity"] },
  { id: "awareness", stage: 5, tools: ["library_index", "library_read"], deliverable: AWARENESS_DELIVERABLE, consistency: "customer_node", maxTurns: 10, waitsFor: ["avatars"] },
  { id: "gate", stage: 4, tools: ["use_source", "library_index", "library_read"], deliverable: GATE_DELIVERABLE, consistency: "market_node", maxTurns: 8, waitsFor: ["market_size", "offers", "sophistication", "breaking_point"] },
];

/** Looking a role up, and the nodes it files under in one run. */
export class Roles {
  static of(id: RoleId): RoleSpec {
    Trace.line(import.meta.url, "Roles.of", { id });
    return ROLES.find((role) => role.id === id)!;
  }

  /** The node a role's rows are filed under: its deliverable's, or for the champion, which has none, competitors when that is in scope and otherwise the run's first node. */
  static node(role: RoleSpec, runNodes: readonly Node[]): Node {
    Trace.line(import.meta.url, "Roles.node", { role: role.id, runNodes });
    const own = role.deliverable.node;
    if (own) return own;
    return runNodes.includes("competitors") ? "competitors" : runNodes[0]!;
  }

  /** The nodes a role may write under: a stage-1 role its own; a stage-2 or stage-5 role every node of the run, since its rows file by kind (the formula's regimen goes under cogs_refills, a quote under language_bank). */
  static scope(role: RoleSpec, runNodes: readonly Node[]): Node[] {
    Trace.line(import.meta.url, "Roles.scope", { role: role.id });
    return role.stage === 2 || role.stage === 5 ? [...runNodes] : [Roles.node(role, runNodes)];
  }
}
