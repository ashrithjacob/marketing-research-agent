import type { Context } from "@earendil-works/chord";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { defineDoc, defineExtension, defineTask, type Task, type TaskId, type TaskRuntime } from "@earendil-works/pi-durable";

import type { ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { PiHarness } from "../pi-harness.js";

/** One thing a watcher looks at (spec §7.3). `check` looks, says something only if something changed, and returns when to look next. */
export interface Watch {
  readonly kind: string;
  check(workspaceId: string, now: number): Promise<number>;
}

type Input = { workspaceId: string; kind: string };
type Phase = { phase: "check" } | { phase: "sleep"; until: number };
type Runtime = TaskRuntime<Input, Phase, null, object>;

const WatcherIndex = defineDoc<{ watchers: Record<string, TaskId> }>({ kind: "mra.watcher-index", version: 1, scope: "session", initial: () => ({ watchers: {} }) });

/** The watchers: one durable task per workspace and watch while Always on is on, each sleeping until its watch says to look again. A restart resumes them where they slept; missed periods fire once, because a check looks at what is due now. */
export class Watchers {
  static readonly MIN_SLEEP_MS = 60_000;
  readonly definition: Task<Input, Phase, null, object>;
  private readonly watches: ReadonlyMap<string, Watch>;

  constructor(
    private readonly store: ResearchStore,
    private readonly harness: PiHarness,
    watches: readonly Watch[],
  ) {
    Trace.line(import.meta.url, "Watchers.constructor", { watches: watches.length });
    this.watches = new Map(watches.map((watch) => [watch.kind, watch]));
    this.definition = defineTask<Input, Phase, null>({
      name: "mra.watcher",
      version: 1,
      initial: () => ({ phase: "check" }),
      phases: {
        check: (task, runtime, context) => this.check(task.input, runtime, context),
        sleep: (task, runtime, context) => this.sleep(task.state.checkpoint.until, runtime, context),
      },
      abort: (_task, runtime, context) => runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context),
    });
    harness.registry.install(defineExtension({ name: "mra.watchers", tasks: [this.definition] }));
  }

  kinds(): string[] {
    Trace.line(import.meta.url, "Watchers.kinds");
    return [...this.watches.keys()];
  }

  async start(workspaceId: string): Promise<void> {
    Trace.line(import.meta.url, "Watchers.start", { workspaceId });
    const root = await this.harness.session.root(BACKGROUND_CONTEXT);
    const { definition } = this;
    const kinds = this.kinds();
    await root.commit(async (tx) => {
      const index = await tx.doc(WatcherIndex);
      for (const kind of kinds) {
        const key = Watchers.key(workspaceId, kind);
        if (index.watchers[key] === undefined) index.watchers[key] = await tx.createTask(definition, { workspaceId, kind }, { ownership: { kind: "conversation" }, background: true });
      }
    }, BACKGROUND_CONTEXT);
  }

  async stop(workspaceId: string): Promise<void> {
    Trace.line(import.meta.url, "Watchers.stop", { workspaceId });
    const root = await this.harness.session.root(BACKGROUND_CONTEXT);
    const kinds = this.kinds();
    const ids = await root.commit(async (tx) => {
      const index = await tx.doc(WatcherIndex);
      const found: TaskId[] = [];
      for (const kind of kinds) {
        const key = Watchers.key(workspaceId, kind);
        if (index.watchers[key] !== undefined) found.push(index.watchers[key]!);
        delete index.watchers[key];
      }
      return found;
    }, BACKGROUND_CONTEXT);
    for (const id of ids) await this.harness.session.abortTask(id, BACKGROUND_CONTEXT);
  }

  private async check(input: Input, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "Watchers.check", { workspaceId: input.workspaceId, kind: input.kind });
    const now = runtime.now();
    const watch = this.watches.get(input.kind);
    const on = (await this.store.alwaysOn.get(input.workspaceId)).on;
    const next = watch && on ? await watch.check(input.workspaceId, now).catch((error: unknown) => Watchers.failed(input, error, now)) : now + 86_400_000;
    const until = Math.max(now + Watchers.MIN_SLEEP_MS, next);
    await runtime.commit(() => ({ status: "running", checkpoint: { phase: "sleep", until } }), context);
  }

  private async sleep(until: number, runtime: Runtime, context: Context): Promise<void> {
    Trace.line(import.meta.url, "Watchers.sleep", { until });
    await runtime.sleep(until, context);
    await runtime.commit(() => ({ status: "running", checkpoint: { phase: "check" } }), context);
  }

  /** A check that throws is logged and tried again in an hour; one failing watch never stops the others. */
  private static failed(input: Input, error: unknown, now: number): number {
    Trace.line(import.meta.url, "Watchers.failed", { kind: input.kind });
    console.error(`watcher ${input.kind} for ${input.workspaceId} failed`, error);
    return now + 3_600_000;
  }

  private static key(workspaceId: string, kind: string): string {
    Trace.line(import.meta.url, "Watchers.key", { workspaceId, kind });
    return `${workspaceId}:${kind}`;
  }
}
