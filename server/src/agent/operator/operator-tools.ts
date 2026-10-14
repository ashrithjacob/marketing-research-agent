import type { Context } from "@earendil-works/chord";
import { Type } from "@earendil-works/pi-ai";
import { defineExtension, section, defineTool, type Extension, type ToolExecutionApi, type ToolExecutionResult } from "@earendil-works/pi-durable";

import { Runs, SAVED_TASKS, Scope, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";
import { OPERATOR_SYSTEM } from "../prompt/text/operator.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

import { WorkspaceDoc } from "./operator-docs.js";
import type { PlanDesk } from "./plan-desk.js";

const list = Type.Array(Type.String());

/** The operator's extension: its prompt and its four tools, each acting only inside the workspace its conversation belongs to. None of them starts work. */
export class OperatorTools {
  constructor(
    private readonly store: ResearchStore,
    private readonly plans: PlanDesk,
    private readonly tasks: TaskSupervisor,
  ) {}

  extension(): Extension {
    Trace.line(import.meta.url, "OperatorTools.extension");
    const saved = Object.entries(SAVED_TASKS).map(([key, task]) => `\`${key}\` (${task.title})`).join(", ");
    return defineExtension({
      name: "mra.operator",
      sections: [section("operator", () => OPERATOR_SYSTEM.replace("{saved}", saved), { tag: false })],
      tools: [
        defineTool({
          name: "list_work",
          description: "The brand's newest plans, and its newest tasks with their status and what they found.",
          parameters: Type.Object({}),
          execute: (_args, api, context) => this.act(api, context, (workspace) => this.work(workspace)),
        }),
        defineTool({
          name: "revise_plan",
          description: "Change a plan the owner has not approved yet: set its market, drop or keep tasks by key, or add saved tasks by key.",
          parameters: Type.Object({ plan_id: Type.String(), market: Type.Optional(Type.String()), drop: Type.Optional(list), keep: Type.Optional(list), add: Type.Optional(list) }),
          execute: (args, api, context) =>
            this.act(api, context, async (workspace) => {
              const { plan_id, ...change } = args;
              const plan = await this.plans.revise(plan_id, Scope.of(workspace), change);
              return `Plan ${plan.id} now: market ${plan.brief.market || "none"}; ${plan.tasks.map((t) => `${t.key} ${t.selected ? "kept" : "dropped"}`).join(", ")}. The owner approves it with its button.`;
            }),
        }),
        defineTool({
          name: "stop_task",
          description: "Stop a running task by its run id. What it found so far is kept.",
          parameters: Type.Object({ run_id: Type.String() }),
          execute: (args, api, context) => this.act(api, context, async (workspace) => (await this.running(args.run_id, workspace), await this.tasks.stop(args.run_id), `Stopping ${args.run_id}.`)),
        }),
        defineTool({
          name: "guide_task",
          description: "Pass the owner's guidance to a running task, by its run id; the task reads it at its next step.",
          parameters: Type.Object({ run_id: Type.String(), text: Type.String() }),
          execute: (args, api, context) => this.act(api, context, (workspace) => this.guide(args.run_id, args.text, workspace)),
        }),
      ],
    });
  }

  private async act(api: ToolExecutionApi, context: Context, work: (workspace: string) => Promise<string>): Promise<ToolExecutionResult> {
    Trace.line(import.meta.url, "OperatorTools.act", { conversation: api.conversationId });
    const workspace = (await api.snapshot(WorkspaceDoc, api.conversationId, context))?.workspace_id ?? "";
    try {
      return { output: [{ type: "text", text: await work(workspace) }] };
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return { output: [{ type: "text", text: error.message }], isError: true };
    }
  }

  private async work(workspace: string): Promise<string> {
    Trace.line(import.meta.url, "OperatorTools.work", { workspace });
    const scope = Scope.of(workspace);
    const plans = (await this.store.plans.list(scope, 3)).map((plan) => ({
      plan_id: plan.id,
      status: plan.status,
      brief: plan.brief,
      tasks: plan.tasks.map((task) => ({ key: task.key, title: task.title, kept: task.selected, run_id: task.run_id, error: task.error })),
    }));
    const tasks = (await this.store.listRuns(scope, 50)).filter((run) => run.contract).slice(0, 10).map((run) => {
      const { status, error, counts } = Runs.summary(run);
      return { run_id: run.id, objective: String(run.contract?.objective ?? ""), status, error, sources: counts.sources, gaps: counts.gaps };
    });
    return JSON.stringify({ plans, tasks }, null, 1);
  }

  private async running(runId: string, workspace: string): Promise<void> {
    Trace.line(import.meta.url, "OperatorTools.running", { runId });
    const run = await this.store.getRun(runId);
    if (!run?.contract || !Scope.of(workspace).admits(run.workspace_id)) throw new RunError(`no task ${runId} in this brand's work`);
    if (run.status !== "running") throw new RunError(`task ${runId} is ${run.status}, not running`);
  }

  private async guide(runId: string, text: string, workspace: string): Promise<string> {
    Trace.line(import.meta.url, "OperatorTools.guide", { runId });
    await this.running(runId, workspace);
    if (!(await this.tasks.guide(runId, text))) throw new RunError(`task ${runId} has no conversation to guide`);
    return `Passed to ${runId}.`;
  }
}
