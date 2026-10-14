import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { defineExtension } from "@earendil-works/pi-durable";

import { Corpus } from "../../adapters/corpus.js";
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
import type { TaskEvents } from "./task-events.js";
import { TaskExtensions } from "./task-extensions.js";
import { TaskIntake } from "./task-intake.js";
import { TaskJudge } from "./task-judge.js";
import { TaskPause } from "./task-pause.js";
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
  events: TaskEvents;
}

/** Durable tasks on the harness: a contract checked and queued as a run, a restart's tasks picked back up, a stop delivered as an abort. */
export class TaskSupervisor {
  private readonly tasks: ResearchTasks;
  private readonly extensions: TaskExtensions;
  private readonly pause: TaskPause;
  private readonly intake: TaskIntake;

  constructor(private readonly deps: TaskSupervisorDeps) {
    Trace.line(import.meta.url, "TaskSupervisor.constructor");
    const { store, runs, settings, tools, costs, harness, events } = deps;
    const works = new TaskWorks({ store, runs, settings, tools, costs });
    const signals = new TaskSignals();
    const readings = new TaskReadings(store, new Corpus(settings.corpusPath));
    const ending = new TaskEnd({ store, runs, costs, works, signals, readings });
    this.pause = new TaskPause(store, runs, signals, events);
    const judge = new TaskJudge(harness, harness.models, settings.judgeModel);
    const extensions = new TaskExtensions(works, signals, readings, harness.registry, judge, this.pause);
    this.extensions = extensions;
    this.tasks = new ResearchTasks({ store, runs, works, extensions, signals, readings, ending, events, pause: this.pause, model: settings.model });
    this.intake = new TaskIntake(store, settings);
    harness.registry.install(defineExtension({ name: "mra.worker", tasks: [this.tasks.definition] }));
  }

  /** A task request checked against its contract, written as a queued run, and handed to the harness; a refused contract throws before anything is written. */
  async start(body: unknown, workspaceId: string, options: { approved?: boolean } = {}): Promise<ResearchRun> {
    Trace.line(import.meta.url, "TaskSupervisor.start", { workspaceId, approved: options.approved === true });
    const run = await this.intake.admit(body, workspaceId, options.approved === true);
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
      else await this.extensions.install(run.id);
      picked += 1;
    }
    return picked;
  }

  /** The owner's answer to a task paused on its stop_when; it goes on from where it stopped. */
  answer(runId: string, answer: string): Promise<void> {
    Trace.line(import.meta.url, "TaskSupervisor.answer", { runId });
    return this.pause.give(runId, answer);
  }

  question(runId: string): Promise<string> {
    Trace.line(import.meta.url, "TaskSupervisor.question", { runId });
    return this.pause.question(runId);
  }

  /** A workspace's tasks waiting for the owner, each with its question. */
  async waiting(workspaceId: string): Promise<{ runId: string; objective: string; question: string }[]> {
    Trace.line(import.meta.url, "TaskSupervisor.waiting", { workspaceId });
    const runs = (await this.deps.store.listRuns(Scope.of(workspaceId), 50)).filter((run) => run.contract && run.status === "waiting");
    return Promise.all(runs.map(async (run) => ({ runId: run.id, objective: String(run.contract?.objective ?? ""), question: await this.pause.question(run.id) })));
  }

  async stop(runId: string): Promise<void> {
    Trace.line(import.meta.url, "TaskSupervisor.stop", { runId });
    const taskId = (await this.deps.harness.session.snapshot(TaskIndex, BACKGROUND_CONTEXT))?.tasks[runId];
    if (taskId !== undefined) await this.deps.harness.session.abortTask(taskId, BACKGROUND_CONTEXT);
  }

  /** The owner's guidance, delivered to a running task's worker at its next step. */
  async guide(runId: string, text: string): Promise<boolean> {
    Trace.line(import.meta.url, "TaskSupervisor.guide", { runId });
    const conversationId = (await this.deps.harness.session.snapshot(TaskIndex, BACKGROUND_CONTEXT))?.conversations[runId];
    const worker = conversationId === undefined ? undefined : await this.deps.harness.session.conversation(conversationId, BACKGROUND_CONTEXT);
    if (!worker) return false;
    await worker.submit({ type: "input", content: `Guidance from the owner: ${text}`, whenBusy: "steer" }, BACKGROUND_CONTEXT);
    return true;
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
