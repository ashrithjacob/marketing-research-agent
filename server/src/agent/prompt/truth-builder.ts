import {
  PRODUCT_TRUTH_AGENT_SPECS,
  type Brief,
  type Judgement,
  type ProductTruthAgent,
  type ProductTruthPacket,
  type StagePacket,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { PromptBlocks } from "./blocks.js";
import { TRUTH_ROLES, TRUTH_SYSTEM_PROMPT } from "./text/truth-system.js";
import { CLAIMS_TASK, COGS_TASK, DOSE_TASK, FORMULA_TASK, MECHANISM_TASK } from "./text/truth-tasks.js";
import { TRUTH_RECORD_TOOLS } from "./text/truth-record-tools.js";
import { TruthBlocks } from "./truth-blocks.js";

export interface TruthInstructions {
  brief: Brief;
  rejectKinds: readonly string[];
  judgements: readonly Judgement[];
  stageOne: StagePacket;
  sofar: ProductTruthPacket;
}

const TASKS: Readonly<Record<ProductTruthAgent, string>> = {
  formula: FORMULA_TASK,
  mechanism: MECHANISM_TASK,
  dose_vs_study: DOSE_TASK,
  claim_limits: CLAIMS_TASK,
  cogs_refills: COGS_TASK,
};

/** Each product-truth agent's system prompt and task, with what stage 1 and the agents before it recorded. */
export class ProductTruthPrompts {
  system(agent: ProductTruthAgent): string {
    Trace.line(import.meta.url, "ProductTruthPrompts.system", { agent });
    const records = TRUTH_RECORD_TOOLS.filter((tool) => PRODUCT_TRUTH_AGENT_SPECS[agent].records.includes(tool.kind)).map((tool) => tool.name);
    return TRUTH_SYSTEM_PROMPT.replace("{agent}", agent).replace("{role}", TRUTH_ROLES[agent]).replace("{record_tools}", PromptBlocks.code(records));
  }

  instructions(agent: ProductTruthAgent, options: TruthInstructions): string {
    Trace.line(import.meta.url, "ProductTruthPrompts.instructions", { agent });
    const { brief, judgements, stageOne, sofar } = options;
    const parts = [TASKS[agent], PromptBlocks.sources(options.rejectKinds)];
    if (judgements.length > 0) parts.push(PromptBlocks.judgements(judgements));
    parts.push(PromptBlocks.brief(brief), TruthBlocks.stageOne(stageOne));
    if (agent === "mechanism" || agent === "dose_vs_study" || agent === "claim_limits") parts.push(TruthBlocks.actives(sofar.actives));
    if (agent === "claim_limits") parts.push(TruthBlocks.doses(sofar.doses));
    parts.push(ProductTruthPrompts.limit(agent));
    return parts.join("\n\n");
  }

  private static limit(agent: ProductTruthAgent): string {
    Trace.line(import.meta.url, "ProductTruthPrompts.limit", { agent });
    const turns = PRODUCT_TRUTH_AGENT_SPECS[agent].maxTurns;
    return `## Your limit\n\nYou have ${turns} turns — one turn is one reply from you, however many tools it calls. After the last, you stop, and everything still open is recorded as a gap for you. Put several tool calls in one turn where you can.`;
  }
}
