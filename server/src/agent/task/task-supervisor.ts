import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { defineExtension } from "@earendil-works/pi-durable";

import type { OpenRouterPrices } from "../../adapters/index.js";
import type { Settings } from "../../config/index.js";
import { Scope, TERMINAL_STATUSES, type ResearchRun, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { LiveRuns } from "../live-runs.js";
import type { PiHarness } from "../pi-harness.js";
import type { ToolRegistry } from "../tools/index.js";

import { ResearchTasks } from "./research-task.js";
import { TaskIndex } from "./run-doc.js";
import { TaskEnd } from "./task-end.js";
import { TaskExtensions } from "./task-extensions.js";
import { TaskIntake } from "./task-intake.js";
import { TaskReadings } from "./task-readings.js";
import { TaskSignals } from "./task-signals.js";
import { TaskWorks } from "./task-work.js";

export interface TaskSupervisorDeps {
  store: ResearchStore;
  runs: LiveRuns;
  settings: Settings;
  harness: PiHarness;
  tools: ToolRegistry;
  costs: OpenRouterPrices;
}

/** Durable tasks on the harness: a contract checked and queued as a run, a restart's tasks picked back up, a stop delivered as an abort. */
export class TaskSupervisor {
  private readonly tasks: ResearchTasks;
  private readonly intake: TaskIntake;

  constructor(private readonly deps: TaskSupervisorDeps) {
    Trace.line(import.meta.url, "TaskSupervisor.constructor");
    const { store, runs, settings, tools, costs, harness } = deps;
    const works = new TaskWorks({ store, runs, settings, tools, costs });
    const signals = new TaskSignals();
    const readings = new TaskReadings(store);
    const ending = new TaskEnd({ store, runs, costs, works, signals, readings });
    const extensions = new TaskExtensions(works, signals, readings);
    this.tasks = new ResearchTasks({ store, runs, works, extensions, signals, readings, ending, registry: harness.registry, model: settings.model });
    this.intake = new TaskIntake(store, settings);
    harness.registry.install(defineExtension({ name: "mra.worker", tasks: [this.tasks.definition] }));
  }

  /** A task request checked against its contract, written as a queued run, and handed to the harness; a refused contract throws before anything is written. */
  async start(body: unknown, workspaceId: string): Promise<ResearchRun> {
    Trace.line(import.meta.url, "TaskSupervisor.start", { workspaceId });
    const run = await this.intake.admit(body, workspaceId);
    await this.queue(run.id);
    return run;
  }

  /** At startup, before resume: each live task's extension installed again, and a run queued before its task was created gets one. */
  async recover(): Promise<number> {
    Trace.line(import.meta.url, "TaskSupervisor.recover");
    let picked = 0;
    for (const run of await this.deps.store.listRuns(Scope.everything, 200)) {
      if (!run.contract || TERMINAL_STATUSES.has(run.status)) continue;
      if (run.status === "queued") await this.queue(run.id);
      else await this.tasks.install(run.id);
      picked += 1;
    }
    return picked;
  }

  async stop(runId: string): Promise<void> {
    Trace.line(import.meta.url, "TaskSupervisor.stop", { runId });
    const taskId = (await this.deps.harness.session.snapshot(TaskIndex, BACKGROUND_CONTEXT))?.tasks[runId];
    if (taskId !== undefined) await this.deps.harness.session.abortTask(taskId, BACKGROUND_CONTEXT);
  }

  /** Creates the run's task once: the index is read and written in the same commit, so a second call finds the first task. */
  private async queue(runId: string): Promise<void> {
    Trace.line(import.meta.url, "TaskSupervisor.queue", { runId });
    const root = await this.deps.harness.session.root(BACKGROUND_CONTEXT);
    const definition = this.tasks.definition;
    await root.commit(async (tx) => {
      const index = await tx.doc(TaskIndex);
      if (index.tasks[runId] !== undefined) return;
      const taskId = await tx.createTask(definition, { runId }, { ownership: { kind: "conversation" }, background: true });
      index.tasks[runId] = taskId;
    }, BACKGROUND_CONTEXT);
  }
}
