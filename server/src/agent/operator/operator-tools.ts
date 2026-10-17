import type { Context } from "@earendil-works/chord";
import { Type } from "@earendil-works/pi-ai";
import { defineExtension, section, defineTool, type Extension, type ToolExecutionApi, type ToolExecutionResult } from "@earendil-works/pi-durable";

import { Brands, SAVED_TASKS, Scope, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { OPERATOR_SYSTEM } from "../prompt/text/operator.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

import { BrandDoc, WorkspaceDoc } from "./operator-docs.js";
import type { AlwaysOnTools } from "../always/always-on-tools.js";
import type { MemoryDesk } from "../learning/memory-desk.js";

import type { CardDesk } from "./card-desk.js";
import type { LibraryShelfTools } from "./library-shelf-tools.js";
import { OperatorAct } from "./operator-act.js";
import type { PlanDesk } from "./plan-desk.js";
import type { RunControlTools } from "./run-control-tools.js";
import type { StageTools } from "./stage-tools.js";
import { WorkReport } from "./work-report.js";

const list = Type.Array(Type.String());

/** The operator's extension: its prompt and its tools, each acting only inside the workspace its conversation belongs to. Only start_stage_one and create_task start work. */
export class OperatorTools {
  constructor(
    private readonly store: ResearchStore,
    private readonly plans: PlanDesk,
    private readonly tasks: TaskSupervisor,
    private readonly cards: CardDesk,
    private readonly memory: MemoryDesk,
    private readonly always: AlwaysOnTools,
    private readonly control: RunControlTools,
    private readonly library: LibraryShelfTools,
    private readonly stageTools: StageTools,
  ) {}

  extension(): Extension {
    Trace.line(import.meta.url, "OperatorTools.extension");
    const saved = Object.entries(SAVED_TASKS).map(([key, task]) => `\`${key}\` (${task.title})`).join(", ");
    return defineExtension({
      name: "mra.operator",
      sections: [
        section("operator", () => OPERATOR_SYSTEM.replace("{saved}", saved), { tag: false }),
        section("this_brand", async (input, context) => OperatorTools.brandLine((await input.read.snapshot(BrandDoc, input.conversationId, context)) ?? { key: "", label: "" })),
        section("brand_memory", async (input, context) => this.memory.section((await input.read.snapshot(WorkspaceDoc, input.conversationId, context))?.workspace_id ?? "")),
      ],
      tools: [
        defineTool({
          name: "list_work",
          description: "The brand's newest plans, and its newest tasks with their status and what they found.",
          parameters: Type.Object({}),
          execute: (_args, api, context) => OperatorAct.run(api, context, (workspace) => new WorkReport(this.store, this.tasks).write(workspace)),
        }),
        defineTool({
          name: "revise_plan",
          description: "Change a plan the owner has not approved yet: set its market, drop or keep tasks by key, add saved tasks by key, or set when a task must stop and ask the owner (stop_when).",
          parameters: Type.Object({
            plan_id: Type.String(),
            market: Type.Optional(Type.String()),
            drop: Type.Optional(list),
            keep: Type.Optional(list),
            add: Type.Optional(list),
            stop_when: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "Per task key, when the task must stop and ask the owner; \"\" removes it." })),
          }),
          execute: (args, api, context) =>
            OperatorAct.run(api, context, async (workspace) => {
              const { plan_id, ...change } = args;
              const plan = await this.plans.revise(plan_id, Scope.of(workspace), change);
              return `Plan ${plan.id} now: market ${plan.brief.market || "none"}; ${plan.tasks.map((t) => `${t.key} ${t.selected ? "kept" : "dropped"}`).join(", ")}. The owner approves it with its button.`;
            }),
        }),
        ...this.control.tools(),
        ...this.stageTools.tools(),
        ...this.library.tools(),
        ...this.always.tools(),
        defineTool({
          name: "send_owner",
          description: "Put a question to the owner as a card they answer; their answer comes back to you as a message. For a decision only they can make; progress needs no card.",
          parameters: Type.Object({ question: Type.String() }),
          execute: (args, api, context) =>
            OperatorAct.run(api, context, async (workspace) => {
              await this.cards.open(workspace, { kind: "question", title: "The operator asks", body: args.question, action: { kind: "reply_operator", brand: await OperatorAct.brand(api, context) } });
              return "Asked; the owner answers on a card, and their answer comes back to you.";
            }),
        }),
      ],
    });
  }

  /** Which brand this chat is about, fixed for the conversation's life. */
  static brandLine(brand: { key: string; label: string }): string {
    Trace.line(import.meta.url, "OperatorTools.brandLine", { key: brand.key });
    if (!brand.key) return "This is the workspace's own chat, about no one brand.";
    const site = Brands.homepage(brand.key);
    return `This chat is about one brand: ${brand.label}${site ? `, whose site is ${site}` : ""}. When the owner asks to research it without naming a page, research ${site ? `that site (\`url\`)` : `"${brand.label}" (\`product\`)`}.`;
  }
}
