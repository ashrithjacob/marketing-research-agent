import type { Context } from "@earendil-works/chord";
import { configure, defineTask, type ConversationId, type SettledSubmissionRecord, type Task, type TaskRuntime } from "@earendil-works/pi-durable";

import type { ResearchStore, Trip } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { LiveRuns } from "../live-runs.js";

import { RunDoc, TaskIndex } from "./run-doc.js";
import type { TaskEnd } from "./task-end.js";
import type { TaskPause } from "./task-pause.js";
import type { TaskEvents } from "./task-events.js";
import type { TaskExtensions } from "./task-extensions.js";
import type { TaskReadings } from "./task-readings.js";
import type { Halt, TaskSignals } from "./task-signals.js";
import type { TaskWorks } from "./task-work.js";

type Round = { conversationId: ConversationId; round: number; input: string | null };
type Phase = { phase: "start" } | ({ phase: "work" } & Round) | ({ phase: "asking"; question: string } & Round) | { phase: "end"; trip: Trip | null; error: string };
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
  events: TaskEvents;
  pause: TaskPause;
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
        work: (task, runtime, context) => Trace.within(task.input.runId, { phase: "work" }, () => this.work(task.input.runId, String(task.id), task.state.checkpoint, runtime, context)),
        asking: (task, runtime, context) => Trace.within(task.input.runId, { phase: "asking" }, () => this.asking(task.input.runId, task.state.checkpoint, runtime, context)),
        end: (task, runtime, context) =>
          Trace.within(task.input.runId, { phase: "end" }, () => this.end(task.input.runId, task.state.checkpoint.trip, task.state.checkpoint.error, runtime, context)),
      },
      abort: (task, runtime, context) => Trace.within(task.input.runId, { phase: "abort" }, () => this.aborted(task.input.runId, runtime, context)),
    });
  }

  private async start(runId: string, taskId: string, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ResearchTasks.start", { runId, taskId });
    const extension = await this.deps.extensions.install(runId);
    const model = { provider: "openrouter", modelId: this.deps.model };
    await runtime.commit(async (tx) => {
      const conversation = await tx.createConversation({ ownership: { kind: "task", taskId: runtime.taskId } });
      await configure(tx, conversation.id, { model, extensions: [extension] });
      (await tx.doc(RunDoc, conversation.id)).run_id = runId;
      (await tx.doc(TaskIndex)).conversations[runId] = conversation.id;
      return { status: "running", checkpoint: { phase: "work", conversationId: conversation.id, round: 0, input: null } };
    }, context);
  }

  /** One round: the instructions, or the owner's answer after a question, submitted once; then the answer, a tripped breaker, or a question to put to the owner, whichever comes first. */
  private async work(runId: string, taskId: string, round: Round, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ResearchTasks.work", { runId, taskId, round: round.round });
    const { conversationId } = round;
    const { store, runs, works, readings, signals } = this.deps;
    await this.deps.extensions.install(runId);
    const work = await works.of(runId);
    const run = await store.getRun(runId);
    if (run?.status === "queued") {
      await store.updateRun(runId, { task_id: taskId, conversation_id: String(conversationId), agent_run_id: runId, session_id: String(conversationId), status: "running" });
      runs.emit(runId, "run.started", { model: this.deps.model, nodes: run.nodes, task_id: taskId });
    }
    const conversation = (await runtime.conversation(conversationId, context))!;
    const already = await readings.trip(runId, work.contract, work.role.maxTurns, Date.now());
    if (already) signals.trip(runId, already);
    const requestId = round.round === 0 ? `task:${runId}` : `task:${runId}:answer:${round.round}`;
    const submission = await conversation.submit({ type: "input", content: round.input ?? work.instructions, requestId }, context);
    const ended = await ResearchTasks.race(submission.wait(context), signals.wait(runId));
    if (!("settled" in ended)) await conversation.abort(context);
    if ("ask" in ended) {
      await this.deps.pause.ask(runId, ended.ask);
      const { round: number, input } = round;
      await runtime.commit(() => ({ status: "running", checkpoint: { phase: "asking", conversationId, round: number, input, question: ended.ask } }), context);
      return;
    }
    const error = "settled" in ended ? ResearchTasks.unanswered(ended.settled) : "";
    const trip = "trip" in ended ? ended.trip : null;
    await runtime.commit(() => ({ status: "running", checkpoint: { phase: "end", trip, error } }), context);
  }

  /** Paused on its stop_when: waits, spending nothing, for the owner's answer, which starts the next round. */
  private async asking(runId: string, paused: Round & { question: string }, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ResearchTasks.asking", { runId, round: paused.round });
    const answer = await this.deps.pause.answer(runId, runtime.signal);
    this.deps.signals.resume(runId);
    const input = `The owner answered your question ("${paused.question}"): ${answer}\nGo on with the task with this in mind.`;
    const next = { conversationId: paused.conversationId, round: paused.round + 1, input };
    await runtime.commit(() => ({ status: "running", checkpoint: { phase: "work", ...next } }), context);
  }

  private async end(runId: string, trip: Trip | null, error: string, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ResearchTasks.end", { runId });
    const status = await this.deps.ending.finish(runId, trip, error);
    await runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: { status } } }), context);
    this.forget(runId);
    await this.deps.events.ended(runId, status);
  }

  private async aborted(runId: string, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ResearchTasks.aborted", { runId });
    const status = await this.deps.ending.stop(runId);
    await runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context);
    this.forget(runId);
    await this.deps.events.ended(runId, status);
  }

  private forget(runId: string): void {
    Trace.line(import.meta.url, "ResearchTasks.forget", { runId });
    this.deps.extensions.uninstall(runId);
    this.deps.works.forget(runId);
    this.deps.signals.forget(runId);
  }

  private static race(settling: Promise<SettledSubmissionRecord>, halting: Promise<Halt>): Promise<{ settled: SettledSubmissionRecord } | Halt> {
    Trace.line(import.meta.url, "ResearchTasks.race");
    const settled = settling.then((record) => ({ settled: record }));
    void settled.catch(() => undefined);
    return Promise.race([settled, halting]);
  }

  private static unanswered(record: SettledSubmissionRecord): string {
    Trace.line(import.meta.url, "ResearchTasks.unanswered", { status: record.status });
    if (record.status === "done" || record.reason === "aborted") return "";
    return `the model did not answer: ${record.reason ?? "unknown"}${record.detail ? ` — ${JSON.stringify(record.detail)}` : ""}`;
  }
}
