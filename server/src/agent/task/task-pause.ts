import { Trace } from "../../trace/index.js";
import type { ResearchStore } from "../../domain/index.js";

import { RunError } from "../errors.js";
import type { LiveRuns } from "../live-runs.js";

import type { TaskEvents } from "./task-events.js";
import type { TaskSignals } from "./task-signals.js";

/** A task paused on its stop_when: the question and the owner's answer are run events in the research store, so a restart finds them; the run is `waiting` in between and spends nothing. */
export class TaskPause {
  static readonly RECHECK_MS = 5000;

  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly signals: TaskSignals,
    private readonly events: TaskEvents,
  ) {}

  async ask(runId: string, question: string): Promise<void> {
    Trace.line(import.meta.url, "TaskPause.ask", { runId });
    this.runs.emit(runId, "run.asked", { question });
    await this.runs.written(runId);
    await this.store.updateRun(runId, { status: "waiting" });
    await this.events.asked(runId, question);
  }

  /** The owner's answer to a waiting task, recorded and handed to it. */
  async give(runId: string, answer: string): Promise<void> {
    Trace.line(import.meta.url, "TaskPause.give", { runId });
    const run = await this.store.getRun(runId);
    if (run?.status !== "waiting") throw new RunError(`task ${runId} is ${run?.status ?? "missing"}, not waiting for an answer`);
    this.runs.emit(runId, "run.answered", { answer });
    await this.runs.written(runId);
    await this.store.updateRun(runId, { status: "running" });
    this.signals.answered(runId);
    await this.events.answered(runId, answer);
  }

  /** Waits for the answer to the run's open question: at once if a restart left it already given, else when it is given, re-reading the store every few seconds in case the wake-up was missed. */
  async answer(runId: string, signal: AbortSignal): Promise<string> {
    Trace.line(import.meta.url, "TaskPause.answer", { runId });
    while (!signal.aborted) {
      const given = await this.given(runId);
      if (given !== null) return given;
      await this.signals.answer(runId, TaskPause.RECHECK_MS);
    }
    throw signal.reason ?? new Error("the task was stopped while it waited");
  }

  /** The question a waiting run is waiting on; "" when it is not waiting. */
  async question(runId: string): Promise<string> {
    Trace.line(import.meta.url, "TaskPause.question", { runId });
    if ((await this.store.getRun(runId))?.status !== "waiting") return "";
    const asked = (await this.store.listEvents(runId)).filter((e) => e.kind === "run.asked").pop();
    return String(asked?.payload.question ?? "");
  }

  /** Every question this run asked, with the answer it got, oldest first. */
  async answered(runId: string): Promise<string[]> {
    Trace.line(import.meta.url, "TaskPause.answered", { runId });
    const pairs: string[] = [];
    let question = "";
    for (const event of await this.store.listEvents(runId)) {
      if (event.kind === "run.asked") question = String(event.payload.question ?? "");
      if (event.kind === "run.answered") pairs.push(`Asked "${question}"; the owner answered: ${String(event.payload.answer ?? "")}`);
    }
    return pairs;
  }

  private async given(runId: string): Promise<string | null> {
    Trace.line(import.meta.url, "TaskPause.given", { runId });
    const events = await this.store.listEvents(runId);
    const asked = events.map((e) => e.kind).lastIndexOf("run.asked");
    const answered = events.slice(asked + 1).find((e) => e.kind === "run.answered");
    return answered ? String(answered.payload.answer ?? "") : null;
  }
}
