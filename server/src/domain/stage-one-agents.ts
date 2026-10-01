import type { Brief } from "./brief.js";
import type { FindingKind } from "./finding-kinds.js";
import type { Node } from "./nodes.js";
import { Trace } from "../trace/index.js";

export const STAGE_ONE_AGENTS = ["champion", "product", "competitors", "category"] as const;
export type StageOneAgent = (typeof STAGE_ONE_AGENTS)[number];

export interface StageOneAgentSpec {
  node: Node | null;
  records: readonly FindingKind[];
  amazon: boolean;
  maxTurns: number;
}

export const STAGE_ONE_AGENT_SPECS: Readonly<Record<StageOneAgent, StageOneAgentSpec>> = {
  champion: { node: null, records: ["source", "competitor_reference", "gap"], amazon: true, maxTurns: 10 },
  product: { node: "product_data", records: ["source", "attribute", "node_status", "gap"], amazon: false, maxTurns: 15 },
  competitors: { node: "competitors", records: ["source", "competitor", "saturation", "node_status", "gap"], amazon: true, maxTurns: 20 },
  category: { node: "category_data", records: ["source", "measurement", "attribute", "node_status", "gap"], amazon: false, maxTurns: 15 },
};

export interface StageOnePlan {
  champion: boolean;
  parallel: StageOneAgent[];
}

/** Which agents a stage-1 run starts: the champion first, unless a url brief without competitors already names it, then one agent per node in scope. */
export class StageOnePlans {
  static of(brief: Brief, nodes: readonly Node[]): StageOnePlan {
    Trace.line(import.meta.url, "StageOnePlans.of", { brief, nodes });
    const parallel = STAGE_ONE_AGENTS.filter((agent) => {
      const node = STAGE_ONE_AGENT_SPECS[agent].node;
      return node !== null && nodes.includes(node);
    });
    const champion = !brief.url.trim() || nodes.includes("competitors");
    return { champion, parallel };
  }

  /** The node an agent's rows are filed under: the champion files under competitors when that node is in scope, otherwise under the run's first node. */
  static nodeOf(agent: StageOneAgent, nodes: readonly Node[]): Node {
    Trace.line(import.meta.url, "StageOnePlans.nodeOf", { agent, nodes });
    const own = STAGE_ONE_AGENT_SPECS[agent].node;
    if (own) return own;
    return nodes.includes("competitors") ? "competitors" : nodes[0]!;
  }
}
