import { Findings, RoleRecords, Roles, type Brief, type Finding, type Judgement, type MarketTruthAgent } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { PromptBlocks } from "./blocks.js";
import { DeliverableTable } from "./deliverable-table.js";
import { MARKET_ROLES, MARKET_SYSTEM_PROMPT } from "./text/market-system.js";
import { BREAKING_POINT_TASK, GATE_TASK, MARKET_SIZE_TASK, OFFERS_TASK, SOPHISTICATION_TASK } from "./text/market-tasks.js";
import { RECORD_TOOLS } from "./text/record-tools.js";

const TASKS: Readonly<Record<MarketTruthAgent, string>> = {
  market_size: MARKET_SIZE_TASK,
  offers: OFFERS_TASK,
  sophistication: SOPHISTICATION_TASK,
  breaking_point: BREAKING_POINT_TASK,
  gate: GATE_TASK,
};

export interface MarketInstructions {
  brief: Brief;
  rejectKinds: readonly string[];
  judgements: readonly Judgement[];
  digest: string;
}

/** Each market-truth agent's system prompt and task, with what the earlier stages found and, for the gate, what the other four recorded. */
export class MarketTruthPrompts {
  system(agent: MarketTruthAgent, tools: string): string {
    Trace.line(import.meta.url, "MarketTruthPrompts.system", { agent });
    const kinds = RoleRecords.of(Roles.of(agent));
    const records = RECORD_TOOLS.filter((tool) => kinds.includes(tool.kind)).map((tool) => tool.name);
    return MARKET_SYSTEM_PROMPT.replace("{agent}", agent).replace("{role}", MARKET_ROLES[agent]).replace("{record_tools}", PromptBlocks.code(records)).replace("{tools}", tools);
  }

  instructions(agent: MarketTruthAgent, options: MarketInstructions, rows: readonly Finding[]): string {
    Trace.line(import.meta.url, "MarketTruthPrompts.instructions", { agent });
    const deliverable = Roles.of(agent).deliverable;
    const table = deliverable.shape === "fields" ? DeliverableTable.render(deliverable) : "";
    const parts = [TASKS[agent].replace("{deliverable}", table), PromptBlocks.sources(options.rejectKinds)];
    if (options.judgements.length > 0) parts.push(PromptBlocks.judgements(options.judgements));
    parts.push(PromptBlocks.brief(options.brief), options.digest);
    if (agent === "gate") parts.push(MarketTruthPrompts.found(rows));
    parts.push(`## Your limit\n\nYou have ${Roles.of(agent).maxTurns} turns — one turn is one reply from you, however many tools it calls. After the last, you stop, and every field still open is recorded as a gap for you.`);
    return parts.join("\n\n");
  }

  /** What the four market-truth agents recorded, for the gate: each live row on one line, sources aside. */
  static found(rows: readonly Finding[]): string {
    Trace.line(import.meta.url, "MarketTruthPrompts.found", { rows: rows.length });
    const kept = Findings.live(rows).filter((row) => row.agent_id !== "gate" && row.kind !== "source");
    const lines = kept.map((row) => `- [${row.agent_id}] ${row.kind}: ${JSON.stringify(row.payload)}`);
    return `## What market truth found in this run\n\n${lines.length > 0 ? lines.join("\n") : "- (nothing yet)"}`;
  }
}
