import {
  FORMS,
  STAGE_ONE_AGENT_SPECS,
  StageOnePlans,
  type Brief,
  type Judgement,
  type Node,
  type StageOneAgent,
} from "../../domain/index.js";

import { PromptBlocks } from "./blocks.js";
import { AMAZON_SEARCH_TOOL } from "./text/amazon-search.js";
import { RECORD_TOOLS } from "./text/record-tools.js";
import { AD_LIBRARY_TOOL, AGENT_ROLES, DISCOVER_TOOL, SYSTEM_PROMPT, WAIT_FOR_TOOL } from "./text/system.js";
import { CATEGORY_TASK, CHAMPION_GENRE_TASK, CHAMPION_URL_TASK, COMPETITORS_TASK, PRODUCT_TASK } from "./text/tasks.js";
import { Trace } from "../../trace/index.js";

export interface AgentInstructions {
  brief: Brief;
  nodes: readonly Node[];
  rejectKinds: readonly string[];
  judgements: readonly Judgement[];
  champion: Record<string, unknown> | null;
}

const TASKS: Readonly<Record<Exclude<StageOneAgent, "champion">, string>> = {
  product: PRODUCT_TASK,
  competitors: COMPETITORS_TASK,
  category: CATEGORY_TASK,
};

/** Each stage-1 agent's own system prompt and task: its role, its fields, where to look and when to stop. */
export class PromptBuilder {
  system(agent: StageOneAgent, options: { amazon: boolean; waits: boolean; discovery?: boolean; ads?: boolean }): string {
    Trace.line(import.meta.url, "PromptBuilder.system", { agent, options });
    const records = RECORD_TOOLS.filter((tool) => STAGE_ONE_AGENT_SPECS[agent].records.includes(tool.kind)).map((tool) => tool.name);
    return SYSTEM_PROMPT.replace("{agent}", agent)
      .replace("{role}", AGENT_ROLES[agent])
      .replace("{record_tools}", PromptBlocks.code(records))
      .replace("{discovery}", options.discovery ? DISCOVER_TOOL : "")
      .replace("{ad_library}", options.ads ? AD_LIBRARY_TOOL : "")
      .replace("{amazon_search}", options.amazon ? AMAZON_SEARCH_TOOL : "")
      .replace("{wait_for}", options.waits ? WAIT_FOR_TOOL : "");
  }

  instructions(agent: StageOneAgent, options: AgentInstructions): string {
    Trace.line(import.meta.url, "PromptBuilder.instructions", { agent });
    const { brief, judgements } = options;
    const parts = [PromptBuilder.task(agent, options), PromptBlocks.sources(options.rejectKinds)];
    if (judgements.length > 0) parts.push(PromptBlocks.judgements(judgements));
    parts.push(PromptBlocks.brief(brief));
    if (agent !== "champion") parts.push(PromptBlocks.champion(options.champion, brief));
    parts.push(PromptBuilder.limit(agent));
    return parts.join("\n\n");
  }

  private static task(agent: StageOneAgent, { brief, nodes }: AgentInstructions): string {
    Trace.line(import.meta.url, "PromptBuilder.task", { agent });
    const text = agent === "champion" ? (brief.url.trim() ? CHAMPION_URL_TASK : CHAMPION_GENRE_TASK) : TASKS[agent];
    return text.replaceAll("{node}", StageOnePlans.nodeOf(agent, nodes)).replaceAll("{forms}", PromptBlocks.code(FORMS));
  }

  private static limit(agent: StageOneAgent): string {
    Trace.line(import.meta.url, "PromptBuilder.limit", { agent });
    const turns = STAGE_ONE_AGENT_SPECS[agent].maxTurns;
    const after =
      agent === "champion"
        ? "you stop, with what you have recorded"
        : "you stop, and every field still open is recorded as a gap for you";
    return `## Your limit\n\nYou have ${turns} turns — one turn is one reply from you, however many tools it calls. After the last, ${after}. Spend them on what is still missing, and put several tool calls in one turn where you can.`;
  }
}
