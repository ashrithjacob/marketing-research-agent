import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolRegistration } from "@earendil-works/pi-durable";

import { SavedPlans, Scope, type Plan } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { OperatorAct } from "./operator-act.js";
import type { PlanDesk } from "./plan-desk.js";

/** The operator's way to start research from the chat: stage 1 for a brief, as a plan approved by the owner's request. A task that would spend Apify money still waits for the owner's Approve button. */
export class StageOneTools {
  constructor(private readonly plans: PlanDesk) {}

  tools(): ToolRegistration[] {
    Trace.line(import.meta.url, "StageOneTools.tools");
    return [
      defineTool({
        name: "start_stage_one",
        description:
          "Start stage-1 market research for one product: its facts, its competitors and its category's numbers, each a task. " +
          "Give the product's page as `url` when the owner gave a link, otherwise its name as `product`; never a link as `product`. " +
          `\`parts\` narrows it to some of ${SavedPlans.parts().join(", ")}; leave it out for all. ` +
          "A task that would spend Apify money waits for the owner's Approve button.",
        parameters: Type.Object({
          url: Type.Optional(Type.String()),
          product: Type.Optional(Type.String()),
          market: Type.Optional(Type.String()),
          parts: Type.Optional(Type.Array(Type.String())),
        }),
        execute: (args, api, context) => OperatorAct.run(api, context, (workspace) => this.start(workspace, args)),
      }),
    ];
  }

  private async start(workspace: string, args: { url?: string; product?: string; market?: string; parts?: string[] }): Promise<string> {
    Trace.line(import.meta.url, "StageOneTools.start", { workspace, parts: args.parts });
    const { parts, ...brief } = args;
    const draft = await this.plans.draft({ brief }, workspace, parts ?? []);
    return StageOneTools.report(await this.plans.approve(draft.id, Scope.of(workspace)));
  }

  /** Each task of the started plan in one line: started with its run id, waiting on another task, or why it did not start. */
  static report(plan: Plan): string {
    Trace.line(import.meta.url, "StageOneTools.report", { planId: plan.id });
    const lines = plan.tasks.filter((task) => task.selected).map((task) => {
      if (task.run_id) return `- ${task.title}: started, task ${task.run_id}`;
      if (task.error) return `- ${task.title}: ${task.error}`;
      return `- ${task.title}: starts when ${task.after.join(", ")} ends`;
    });
    return [`Plan ${plan.id} for ${plan.brief.product || plan.brief.url}:`, ...lines].join("\n");
  }
}
