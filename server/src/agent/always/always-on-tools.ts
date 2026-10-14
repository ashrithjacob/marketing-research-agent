import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolRegistration } from "@earendil-works/pi-durable";

import { Trace } from "../../trace/index.js";

import { OperatorAct } from "../operator/operator-act.js";

import type { ScheduleDesk } from "./schedule-desk.js";
import type { TaskCreation } from "./task-creation.js";

const brief = Type.Object({ url: Type.Optional(Type.String()), product: Type.Optional(Type.String()), market: Type.Optional(Type.String()) });

/** The operator's tools for work nobody clicked: create_task, and set_schedule for the owner's cadences. */
export class AlwaysOnTools {
  constructor(
    private readonly creation: TaskCreation,
    private readonly schedules: ScheduleDesk,
  ) {}

  tools(): ToolRegistration[] {
    Trace.line(import.meta.url, "AlwaysOnTools.tools");
    return [
      defineTool({
        name: "create_task",
        description: "Start a saved task for a brief. With Always on and inside the limits, product_facts and category_numbers start at once; anything else becomes a plan the owner approves.",
        parameters: Type.Object({ task_key: Type.String(), brief }),
        execute: (args, api, context) => OperatorAct.run(api, context, (workspace) => this.creation.create(workspace, args.task_key, args.brief)),
      }),
      defineTool({
        name: "set_schedule",
        description: "Have a saved task run again every so many days for a brief, while Always on is on: the owner's cadence, such as product facts monthly.",
        parameters: Type.Object({ task_key: Type.String(), every_days: Type.Number(), brief }),
        execute: (args, api, context) =>
          OperatorAct.run(api, context, async (workspace) => {
            const made = await this.schedules.add(workspace, args.task_key, args.every_days, args.brief);
            return `Scheduled ${made.task_key} every ${made.every_days} days (schedule ${made.id}). It runs only while Always on is on.`;
          }),
      }),
    ];
  }
}
