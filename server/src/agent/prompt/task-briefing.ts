import { RoleRecords, type Brief, type RoleSpec, type TaskContract } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { PromptBlocks } from "./blocks.js";
import { ContractTable } from "./contract-table.js";
import { EXCERPT_RECORD } from "./text/excerpt-tool.js";
import { RECORD_TOOLS } from "./text/record-tools.js";
import { TASK_EXCERPTS, TASK_INSTRUCTIONS, TASK_SYSTEM } from "./text/task.js";

/** A task's prompts, from its contract: the worker's rules around the tools it was given, and its objective with what done means. */
export class TaskBriefing {
  constructor(
    private readonly contract: TaskContract,
    private readonly brief: Brief,
  ) {}

  system(role: RoleSpec, tools: string): string {
    Trace.line(import.meta.url, "TaskBriefing.system", { role: role.id });
    const kinds = RoleRecords.of(role);
    const records = [...RECORD_TOOLS, EXCERPT_RECORD].filter((tool) => kinds.includes(tool.kind)).map((tool) => tool.name);
    return TASK_SYSTEM.replace("{tools}", tools)
      .replace("{record_tools}", PromptBlocks.code(records))
      .replace("{excerpts}", kinds.includes("excerpt") ? TASK_EXCERPTS : "");
  }

  instructions(): string {
    Trace.line(import.meta.url, "TaskBriefing.instructions");
    const { contract, brief } = this;
    const task = TASK_INSTRUCTIONS.replace("{objective}", contract.objective)
      .replace("{deliverable}", ContractTable.render(contract.complete))
      .replace("{node}", contract.complete.node ?? "");
    return [task, PromptBlocks.sources([]), PromptBlocks.brief(brief)].join("\n\n");
  }
}
