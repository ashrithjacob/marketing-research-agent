import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolRegistration } from "@earendil-works/pi-durable";

import { Scope, type ResearchRun, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

import { OperatorAct } from "./operator-act.js";

/** How a stage run is stopped and guided: the run supervisor's, as the dashboard's Stop and Step in reach it. */
export interface StageRunControl {
  stop: (runId: string) => Promise<void>;
  steer: (runId: string, text: string) => Promise<void>;
}

/** The operator's hand on research while it runs: stop it, guide it, answer its question. A research task and a stage run are reached the same way from the chat; each goes to whatever runs it. */
export class RunControlTools {
  constructor(
    private readonly store: ResearchStore,
    private readonly tasks: TaskSupervisor,
    private readonly stages: StageRunControl,
  ) {}

  tools(): ToolRegistration[] {
    Trace.line(import.meta.url, "RunControlTools.tools");
    return [
      defineTool({
        name: "stop_research",
        description: "Stop running research by its run id: a stage or a task. What it found so far is kept.",
        parameters: Type.Object({ run_id: Type.String() }),
        execute: (args, api, context) => OperatorAct.run(api, context, (workspace) => this.stop(args.run_id, workspace)),
      }),
      defineTool({
        name: "guide_research",
        description: "Pass the owner's guidance to running research by its run id, a stage or a task; it reads it at its next step.",
        parameters: Type.Object({ run_id: Type.String(), text: Type.String() }),
        execute: (args, api, context) => OperatorAct.run(api, context, (workspace) => this.guide(args.run_id, args.text, workspace)),
      }),
      defineTool({
        name: "answer_task",
        description: "Pass the owner's answer to a task that is paused and waiting on its question; it goes on with the answer.",
        parameters: Type.Object({ run_id: Type.String(), answer: Type.String() }),
        execute: (args, api, context) =>
          OperatorAct.run(api, context, async (workspace) => {
            const run = await this.owned(args.run_id, workspace);
            if (!run.contract) throw new RunError(`${args.run_id} is a stage run; it asks nothing`);
            await this.tasks.answer(args.run_id, args.answer);
            return `Passed the answer to ${args.run_id}; it goes on.`;
          }),
      }),
    ];
  }

  private async stop(runId: string, workspace: string): Promise<string> {
    Trace.line(import.meta.url, "RunControlTools.stop", { runId });
    const run = await this.running(runId, workspace);
    await (run.contract ? this.tasks.stop(runId) : this.stages.stop(runId));
    return `Stopping ${runId}; what it found so far is kept.`;
  }

  private async guide(runId: string, text: string, workspace: string): Promise<string> {
    Trace.line(import.meta.url, "RunControlTools.guide", { runId });
    const run = await this.running(runId, workspace);
    if (!run.contract) return (await this.stages.steer(runId, text), `Passed to ${runId}.`);
    if (!(await this.tasks.guide(runId, text))) throw new RunError(`${runId} has no conversation to guide`);
    return `Passed to ${runId}.`;
  }

  private async owned(runId: string, workspace: string): Promise<ResearchRun> {
    Trace.line(import.meta.url, "RunControlTools.owned", { runId });
    const run = await this.store.getRun(runId);
    if (!run || !Scope.of(workspace).admits(run.workspace_id)) throw new RunError(`no research ${runId} in this brand's work`);
    return run;
  }

  private async running(runId: string, workspace: string): Promise<ResearchRun> {
    Trace.line(import.meta.url, "RunControlTools.running", { runId });
    const run = await this.owned(runId, workspace);
    if (run.status !== "running") throw new RunError(`${runId} is ${run.status}, not running`);
    return run;
  }
}
