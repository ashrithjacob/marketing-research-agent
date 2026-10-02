import type { Brief } from "./brief.js";
import type { Node } from "./nodes.js";
import { Roles } from "./research-roles.js";
import { Trace } from "../trace/index.js";

export const STAGE_ONE_AGENTS = ["champion", "product", "competitors", "category"] as const;
export type StageOneAgent = (typeof STAGE_ONE_AGENTS)[number];

export interface StageOnePlan {
  champion: boolean;
  parallel: StageOneAgent[];
}

/** Which agents a stage-1 run starts: the champion first, unless a url brief without competitors already names it, then one agent per node in scope. */
export class StageOnePlans {
  static of(brief: Brief, nodes: readonly Node[]): StageOnePlan {
    Trace.line(import.meta.url, "StageOnePlans.of", { brief, nodes });
    const parallel = STAGE_ONE_AGENTS.filter((agent) => {
      const node = Roles.of(agent).deliverable.node;
      return node !== null && nodes.includes(node);
    });
    const champion = !brief.url.trim() || nodes.includes("competitors");
    return { champion, parallel };
  }

  /** The node an agent's rows are filed under: the champion files under competitors when that node is in scope, otherwise under the run's first node. */
  static nodeOf(agent: StageOneAgent, nodes: readonly Node[]): Node {
    Trace.line(import.meta.url, "StageOnePlans.nodeOf", { agent, nodes });
    return Roles.node(Roles.of(agent), nodes);
  }
}
