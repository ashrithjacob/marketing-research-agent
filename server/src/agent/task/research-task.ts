import type { Context } from "@earendil-works/chord";
import { configure, defineExtension, defineTask, type ConversationId, type Extension, type Registry, type SettledSubmissionRecord, type Task, type TaskRuntime } from "@earendil-works/pi-durable";

import type { ResearchStore, Trip } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { LiveRuns } from "../live-runs.js";

import { RunDoc } from "./run-doc.js";
import type { TaskEnd } from "./task-end.js";
import { TaskExtensions } from "./task-extensions.js";
import type { TaskReadings } from "./task-readings.js";
import type { TaskSignals } from "./task-signals.js";
import type { TaskWorks } from "./task-work.js";

type Phase = { phase: "start" } | { phase: "work"; conversationId: ConversationId } | { phase: "end"; trip: Trip | null; error: string };
type Input = { runId: string };
type Runtime = TaskRuntime<Input, Phase, { status: string }, object>;

export interface ResearchTaskDeps {
  store: ResearchStore;
  runs: LiveRuns;
  works: TaskWorks;
  extensions: TaskExtensions;
  signals: TaskSignals;
  readings: TaskReadings;
  ending: TaskEnd;
  registry: Registry;
  model: string;
}

/** The durable research task: it opens a worker conversation on its run's extension, waits for the answer or a tripped breaker, and ends the run through RunEnd. Each phase is checkpointed, so a restart continues where it stopped. */
export class ResearchTasks {
  readonly definition: Task<Input, Phase, { status: string }, object>;

  constructor(private readonly deps: ResearchTaskDeps) {
    Trace.line(import.meta.url, "ResearchTasks.constructor");
    this.definition = defineTask<Input, Phase, { status: string }>({
      name: "mra.research",
      version: 1,
      initial: () => ({ phase: "start" }),
      phases: {
        start: (task, runtime, context) => Trace.within(task.input.runId, { phase: "start" }, () => this.start(task.input.runId, String(task.id), runtime, context)),
        work: (task, runtime, context) => Trace.within(task.input.runId, { phase: "work" }, () => this.work(task.input.runId, String(task.id), task.state.checkpoint.conversationId, runtime, context)),
        end: (task, runtime, context) =>
          Trace.within(task.input.runId, { phase: "end" }, () => this.end(task.input.runId, task.state.checkpoint.trip, task.state.checkpoint.error, runtime, context)),
      },
      abort: (task, runtime, context) => Trace.within(task.input.runId, { phase: "abort" }, () => this.aborted(task.input.runId, runtime, context)),
    });
  }

  /** The run's extension, built and installed if this process has not yet: before a task's first phase, and after a restart before resume. */
  async install(runId: string): Promise<Extension> {
    Trace.line(import.meta.url, "ResearchTasks.install", { runId });
    const installed = this.deps.registry.snapshot().extension(TaskExtensions.nameOf(runId));
    if (installed) return installed;
    const extension = await this.deps.extensions.build(runId);
    this.deps.registry.install(extension);
    return extension;
  }

  private async start(runId: string, taskId: string, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ResearchTasks.start", { runId, taskId });
    const extension = await this.install(runId);
    const model = { provider: "openrouter", modelId: this.deps.model };
    await runtime.commit(async (tx) => {
      const conversation = await tx.createConversation({ ownership: { kind: "task", taskId: runtime.taskId } });
      await configure(tx, conversation.id, { model, extensions: [extension] });
      (await tx.doc(RunDoc, conversation.id)).run_id = runId;
      return { status: "running", checkpoint: { phase: "work", conversationId: conversation.id } };
    }, context);
  }

  private async work(runId: string, taskId: string, conversationId: ConversationId, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ResearchTasks.work", { runId, taskId, conversationId });
    const { store, runs, works, readings, signals } = this.deps;
    await this.install(runId);
    const work = await works.of(runId);
    const run = await store.getRun(runId);
    if (run?.status === "queued") {
      await store.updateRun(runId, { task_id: taskId, conversation_id: String(conversationId), agent_run_id: runId, session_id: String(conversationId), status: "running" });
      runs.emit(runId, "run.started", { model: this.deps.model, nodes: run.nodes, task_id: taskId });
    }
    const conversation = (await runtime.conversation(conversationId, context))!;
    const already = await readings.trip(runId, work.contract, work.role.maxTurns, Date.now());
    if (already) signals.trip(runId, already);
    const submission = await conversation.submit({ type: "input", content: work.instructions, requestId: `task:${runId}` }, context);
    const ended = await ResearchTasks.race(submission.wait(context), signals.wait(runId));
    if ("trip" in ended) await conversation.abort(context);
    const error = "settled" in ended ? ResearchTasks.unanswered(ended.settled) : "";
    const trip = "trip" in ended ? ended.trip : null;
    await runtime.commit(() => ({ status: "running", checkpoint: { phase: "end", trip, error } }), context);
  }

  private async end(runId: string, trip: Trip | null, error: string, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ResearchTasks.end", { runId });
    const status = await this.deps.ending.finish(runId, trip, error);
    await runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: { status } } }), context);
    this.forget(runId);
  }

  private async aborted(runId: string, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ResearchTasks.aborted", { runId });
    await this.deps.ending.stop(runId);
    await runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context);
    this.forget(runId);
  }

  private forget(runId: string): void {
    Trace.line(import.meta.url, "ResearchTasks.forget", { runId });
    this.deps.registry.uninstall(defineExtension({ name: TaskExtensions.nameOf(runId) }));
    this.deps.works.forget(runId);
    this.deps.signals.forget(runId);
  }

  private static race(settling: Promise<SettledSubmissionRecord>, tripping: Promise<Trip>): Promise<{ settled: SettledSubmissionRecord } | { trip: Trip }> {
    Trace.line(import.meta.url, "ResearchTasks.race");
    const settled = settling.then((record) => ({ settled: record }));
    void settled.catch(() => undefined);
    return Promise.race([settled, tripping.then((trip) => ({ trip }))]);
  }

  private static unanswered(record: SettledSubmissionRecord): string {
    Trace.line(import.meta.url, "ResearchTasks.unanswered", { status: record.status });
    if (record.status === "done" || record.reason === "aborted") return "";
    return `the model did not answer: ${record.reason ?? "unknown"}${record.detail ? ` — ${JSON.stringify(record.detail)}` : ""}`;
  }
}
