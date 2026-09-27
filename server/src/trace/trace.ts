import { AsyncLocalStorage } from "node:async_hooks";

import { TraceFormat } from "./trace-format.js";

export interface TraceSink {
  write(runId: string | null, line: string): void;
}

/** One trace line written while a tool call ran, kept so the activity page can show inside the tool. */
export interface TraceStep {
  at: string;
  file: string;
  name: string;
  fields: string;
}

interface TraceScope {
  readonly runId: string | null;
  readonly startedAt: number;
  readonly ticks: Map<string, { count: number; file: string; name: string }>;
  readonly toolCallId?: string;
  readonly steps?: TraceStep[];
  lastWrite: number;
}

const TICK_FLUSH_MS = 5000;
const MAX_STEPS = 300;

/** The one ambient object: every function writes a line; its run comes from the async context. */
export class Trace {
  private static readonly scopes = new AsyncLocalStorage<TraceScope>();
  private static readonly outside: TraceScope = {
    runId: null,
    startedAt: Date.now(),
    ticks: new Map(),
    lastWrite: Date.now(),
  };
  private static sink: TraceSink | null = null;

  static install(sink: TraceSink | null): void {
    Trace.sink = sink;
  }

  static within<T>(runId: string, details: Record<string, unknown>, work: () => T): T {
    const scope: TraceScope = { runId, startedAt: Date.now(), ticks: new Map(), lastWrite: Date.now() };
    return Trace.scopes.run(scope, () => {
      Trace.write(scope, "trace/trace.ts", `run ${runId}`, details);
      return work();
    });
  }

  static withinTool<T>(toolCallId: string, steps: TraceStep[], work: () => T): T {
    const parent = Trace.current();
    const scope: TraceScope = {
      runId: parent.runId,
      startedAt: parent.startedAt,
      ticks: new Map(),
      toolCallId,
      steps,
      lastWrite: Date.now(),
    };
    return Trace.scopes.run(scope, () => {
      const result = work();
      if (result instanceof Promise) {
        return result.finally(() => Trace.flush(scope, Date.now())) as T;
      }
      Trace.flush(scope, Date.now());
      return result;
    });
  }

  static line(fileUrl: string, name: string, fields?: Record<string, unknown>): void {
    const scope = Trace.current();
    if (!Trace.sink && !scope.steps) return;
    Trace.write(scope, TraceFormat.file(fileUrl), name, fields);
  }

  static tick(fileUrl: string, name: string, fields?: Record<string, unknown>): void {
    const scope = Trace.current();
    if (!Trace.sink && !scope.steps) return;
    const file = TraceFormat.file(fileUrl);
    const label = fields ? `${name} ${TraceFormat.fields(fields)}` : name;
    const key = `${file}|${label}`;
    const seen = scope.ticks.get(key);
    if (seen) seen.count += 1;
    else scope.ticks.set(key, { count: 1, file, name: label });
    if (Date.now() - scope.lastWrite >= TICK_FLUSH_MS) Trace.flush(scope, Date.now());
  }

  private static current(): TraceScope {
    return Trace.scopes.getStore() ?? Trace.outside;
  }

  private static write(
    scope: TraceScope,
    file: string,
    name: string,
    fields?: Record<string, unknown>,
  ): void {
    const now = Date.now();
    Trace.flush(scope, now);
    const rendered = fields ? TraceFormat.fields(fields) : "";
    Trace.sink?.write(scope.runId, TraceFormat.line(now, scope.startedAt, file, name, fields, scope.toolCallId));
    Trace.keep(scope, now, file, name, rendered);
  }

  private static keep(scope: TraceScope, now: number, file: string, name: string, fields: string): void {
    if (!scope.steps || scope.steps.length > MAX_STEPS) return;
    scope.steps.push(
      scope.steps.length === MAX_STEPS
        ? { at: new Date(now).toISOString(), file: "", name: `… more lines in the run trace`, fields: "" }
        : { at: new Date(now).toISOString(), file, name, fields },
    );
  }

  private static flush(scope: TraceScope, now: number): void {
    scope.lastWrite = now;
    for (const tick of scope.ticks.values()) {
      const line = TraceFormat.line(now, scope.startedAt, tick.file, tick.name, undefined, scope.toolCallId);
      Trace.sink?.write(scope.runId, `${line} ×${tick.count}`);
      Trace.keep(scope, now, tick.file, `${tick.name} ×${tick.count}`, "");
    }
    scope.ticks.clear();
  }
}
