import { AsyncLocalStorage } from "node:async_hooks";

import { TraceFormat } from "./trace-format.js";

export interface TraceSink {
  write(runId: string | null, line: string): void;
}

interface TraceScope {
  readonly runId: string | null;
  readonly startedAt: number;
  readonly ticks: Map<string, { count: number; file: string; name: string }>;
  lastWrite: number;
}

const TICK_FLUSH_MS = 5000;

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

  static line(fileUrl: string, name: string, fields?: Record<string, unknown>): void {
    if (!Trace.sink) return;
    Trace.write(Trace.current(), TraceFormat.file(fileUrl), name, fields);
  }

  static tick(fileUrl: string, name: string, fields?: Record<string, unknown>): void {
    if (!Trace.sink) return;
    const scope = Trace.current();
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
    Trace.sink?.write(scope.runId, TraceFormat.line(now, scope.startedAt, file, name, fields));
  }

  private static flush(scope: TraceScope, now: number): void {
    scope.lastWrite = now;
    for (const tick of scope.ticks.values()) {
      Trace.sink?.write(scope.runId, `${TraceFormat.line(now, scope.startedAt, tick.file, tick.name)} ×${tick.count}`);
    }
    scope.ticks.clear();
  }
}
