import { Findings, RoleRecords, Roles, type Brief, type CustomerTruthAgent, type Finding } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { PromptBlocks } from "./blocks.js";
import { DeliverableTable } from "./deliverable-table.js";
import { CUSTOMER_ROLES, CUSTOMER_SYSTEM_PROMPT } from "./text/customer-system.js";
import { AVATARS_TASK, AWARENESS_TASK, IDENTITY_TASK, VOICES_TASK } from "./text/customer-tasks.js";
import { RECORD_TOOLS } from "./text/record-tools.js";

const TASKS: Readonly<Record<CustomerTruthAgent, string>> = { voices: VOICES_TASK, identity: IDENTITY_TASK, avatars: AVATARS_TASK, awareness: AWARENESS_TASK };

export interface CustomerInstructions {
  brief: Brief;
  digest: string;
}

/** Each customer-truth agent's system prompt and task, with what the earlier stages found and, for the avatars and awareness agents, what the agents before them recorded. */
export class CustomerTruthPrompts {
  static readonly QUOTE_CHARS = 300;

  system(agent: CustomerTruthAgent, tools: string): string {
    Trace.line(import.meta.url, "CustomerTruthPrompts.system", { agent });
    const kinds = RoleRecords.of(Roles.of(agent));
    const records = RECORD_TOOLS.filter((tool) => kinds.includes(tool.kind)).map((tool) => tool.name);
    return CUSTOMER_SYSTEM_PROMPT.replace("{agent}", agent).replace("{role}", CUSTOMER_ROLES[agent]).replace("{record_tools}", PromptBlocks.code([...records, "record_quote"])).replace("{tools}", tools);
  }

  instructions(agent: CustomerTruthAgent, options: CustomerInstructions, rows: readonly Finding[]): string {
    Trace.line(import.meta.url, "CustomerTruthPrompts.instructions", { agent });
    const deliverable = Roles.of(agent).deliverable;
    const table = deliverable.shape === "fields" ? DeliverableTable.render(deliverable) : "";
    const parts = [TASKS[agent].replace("{deliverable}", table), PromptBlocks.brief(options.brief), options.digest];
    if (agent === "avatars" || agent === "awareness") parts.push(CustomerTruthPrompts.found(rows, agent === "avatars" ? ["quote", "identity_entry", "pain_profile"] : ["avatar"]));
    parts.push(`## Your limit\n\nYou have ${Roles.of(agent).maxTurns} turns — one turn is one reply from you, however many tools it calls. After the last, you stop, and every field still open is recorded as a gap for you.`);
    return parts.join("\n\n");
  }

  /** What the agents before this one recorded, each row on one line with its id. */
  private static found(rows: readonly Finding[], kinds: readonly string[]): string {
    Trace.line(import.meta.url, "CustomerTruthPrompts.found", { kinds });
    const kept = Findings.live(rows).filter((row) => kinds.includes(row.kind));
    const lines = kept.map((row) => (row.kind === "quote" ? CustomerTruthPrompts.quote(row) : `- ${row.id} ${row.kind}: ${JSON.stringify(row.payload)}`));
    return `## What the agents before you recorded\n\n${lines.length > 0 ? lines.join("\n") : "- (nothing yet)"}`;
  }

  private static quote(row: Finding): string {
    Trace.tick(import.meta.url, "CustomerTruthPrompts.quote");
    const p = row.payload;
    const text = String(p.text ?? "");
    return `- ${row.id} · ${String(p.function)}${p.buyer_stage ? ` · ${String(p.buyer_stage)}` : ""}${p.star ? ` · ${String(p.star)}★` : ""} · "${text.length > CustomerTruthPrompts.QUOTE_CHARS ? `${text.slice(0, CustomerTruthPrompts.QUOTE_CHARS)}…` : text}"`;
  }
}
