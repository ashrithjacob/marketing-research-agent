import type { Context } from "@earendil-works/chord";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { defineDoc, defineExtension, defineTask, type Task, type TaskId, type TaskRuntime } from "@earendil-works/pi-durable";

import { Schedules, type ResearchStore, type Schedule } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { PiHarness } from "../pi-harness.js";

type Phase = { phase: "check" } | { phase: "sleep"; until: number };
type Runtime = TaskRuntime<{ workspaceId: string }, Phase, null, object>;

const WatcherIndex = defineDoc<{ workspaces: Record<string, TaskId> }>({ kind: "mra.watchers", version: 1, scope: "session", initial: () => ({ workspaces: {} }) });

/** The schedule watcher (spec §7.3): one durable task per workspace with Always on, that sleeps until a schedule is due, then tells the operator. Missed periods fire once; a check that finds nothing due says nothing. */
export class ScheduleWatchers {
  static readonly DAY_MS = 86_400_000;
  readonly definition: Task<{ workspaceId: string }, Phase, null, object>;

  constructor(
    private readonly store: ResearchStore,
    private readonly harness: PiHarness,
    private readonly signal: (workspaceId: string, schedule: Schedule, dueAt: string) => Promise<void>,
  ) {
    Trace.line(import.meta.url, "ScheduleWatchers.constructor");
    this.definition = defineTask<{ workspaceId: string }, Phase, null>({
      name: "mra.schedule-watcher",
      version: 1,
      initial: () => ({ phase: "check" }),
      phases: {
        check: (task, runtime, context) => this.check(task.input.workspaceId, runtime, context),
        sleep: (task, runtime, context) => this.sleep(task.state.checkpoint.until, runtime, context),
      },
      abort: (_task, runtime, context) => runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context),
    });
    harness.registry.install(defineExtension({ name: "mra.watchers", tasks: [this.definition] }));
  }

  async start(workspaceId: string): Promise<void> {
    Trace.line(import.meta.url, "ScheduleWatchers.start", { workspaceId });
    const root = await this.harness.session.root(BACKGROUND_CONTEXT);
    const definition = this.definition;
    await root.commit(async (tx) => {
      const index = await tx.doc(WatcherIndex);
      if (index.workspaces[workspaceId] !== undefined) return;
      index.workspaces[workspaceId] = await tx.createTask(definition, { workspaceId }, { ownership: { kind: "conversation" }, background: true });
    }, BACKGROUND_CONTEXT);
  }

  async stop(workspaceId: string): Promise<void> {
    Trace.line(import.meta.url, "ScheduleWatchers.stop", { workspaceId });
    const root = await this.harness.session.root(BACKGROUND_CONTEXT);
    const taskId = await root.commit(async (tx) => {
      const index = await tx.doc(WatcherIndex);
      const id = index.workspaces[workspaceId];
      delete index.workspaces[workspaceId];
      return id;
    }, BACKGROUND_CONTEXT);
    if (taskId !== undefined) await this.harness.session.abortTask(taskId, BACKGROUND_CONTEXT);
  }

  private async check(workspaceId: string, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ScheduleWatchers.check", { workspaceId });
    const now = runtime.now();
    const schedules = (await this.store.alwaysOn.get(workspaceId)).on ? await this.store.schedules.list(workspaceId) : [];
    for (const schedule of schedules.filter((s) => Schedules.nextDue(s) <= now)) {
      const dueAt = new Date(now).toISOString();
      await this.signal(workspaceId, schedule, dueAt);
      await this.store.schedules.signalled(schedule.id, dueAt);
    }
    const next = (await this.store.schedules.list(workspaceId)).map((s) => Schedules.nextDue(s));
    const until = Math.max(now + 60_000, Math.min(now + ScheduleWatchers.DAY_MS, ...next));
    await runtime.commit(() => ({ status: "running", checkpoint: { phase: "sleep", until } }), context);
  }

  private async sleep(until: number, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "ScheduleWatchers.sleep", { until });
    await runtime.sleep(until, context);
    await runtime.commit(() => ({ status: "running", checkpoint: { phase: "check" } }), context);
  }
}
