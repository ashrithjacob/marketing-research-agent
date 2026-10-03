import type { LlmCall, ResearchRun, RunEvent } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** The log page's header, for the whole run and for each agent, summed from recorded rows so it can only undercount. */
export class CallStats {
  static of(run: ResearchRun, calls: readonly LlmCall[], events: readonly RunEvent[], live: boolean): Record<string, unknown> {
    Trace.line(import.meta.url, "CallStats.of", { runId: run.id, calls: calls.length, events: events.length, live });
    const end = run.ended_at ? Date.parse(run.ended_at) : live ? Date.now() : Date.parse(run.updated_at);
    const agents = [...new Set(events.filter((e) => e.kind === "agent.started").map((e) => String(e.payload.agent_id ?? "")))];
    return {
      ...CallStats.window(calls, events, Date.parse(run.created_at), end, !run.ended_at && live),
      agents: Object.fromEntries(agents.map((id) => [id, CallStats.agent(id, calls, events, end)])),
    };
  }

  /** One agent's share: its own calls and tools, timed from its start to its end, or to the run's end while it still runs. */
  private static agent(id: string, calls: readonly LlmCall[], events: readonly RunEvent[], runEnd: number): Record<string, unknown> {
    Trace.line(import.meta.url, "CallStats.agent", { id });
    const own = events.filter((e) => e.payload.agent_id === id);
    const started = own.find((e) => e.kind === "agent.started")?.created_at ?? "";
    const ended = own.find((e) => e.kind === "agent.ended")?.created_at ?? "";
    return CallStats.window(calls.filter((c) => c.agent_id === id), own, Date.parse(started), ended ? Date.parse(ended) : runEnd, !ended);
  }

  private static window(calls: readonly LlmCall[], events: readonly RunEvent[], start: number, end: number, open: boolean): Record<string, unknown> {
    Trace.line(import.meta.url, "CallStats.window", { calls: calls.length });
    const sum = (pick: (call: LlmCall) => number | undefined) => calls.reduce((total, call) => total + (pick(call) ?? 0), 0);
    const usage = (call: LlmCall) => call.usage as Record<string, any>;
    const billed = calls.filter((call) => call.billed_cost !== null);
    const toolEnds = events.filter((e) => e.kind === "tool.completed");
    return {
      llm_calls: calls.length,
      llm_errors: calls.filter((call) => call.error !== "").length,
      tokens: {
        input: sum((call) => usage(call).input),
        output: sum((call) => usage(call).output),
        cache_read: sum((call) => usage(call).cacheRead),
        cache_write: sum((call) => usage(call).cacheWrite),
        total: sum((call) => usage(call).totalTokens),
      },
      billed: { total: billed.reduce((total, call) => total + (call.billed_cost ?? 0), 0), resolved: billed.length },
      llm_time_ms: CallStats.busy(calls),
      wall_time_ms: Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0,
      started_at: Number.isFinite(start) ? new Date(start).toISOString() : "",
      open,
      tool_calls: toolEnds.length,
      tool_errors: toolEnds.filter((e) => e.payload.error === true).length,
    };
  }

  /** Time with at least one call in flight: agents run side by side, so summing their calls would count the same minute up to three times. */
  private static busy(calls: readonly LlmCall[]): number {
    Trace.line(import.meta.url, "CallStats.busy", { calls: calls.length });
    const spans = calls
      .map((c) => [Date.parse(c.started_at), Date.parse(c.started_at) + c.duration_ms] as const)
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b))
      .sort((x, y) => x[0] - y[0]);
    let total = 0;
    let open = -Infinity;
    let close = -Infinity;
    for (const [a, b] of spans) {
      if (a > close) {
        total += close - open > 0 ? close - open : 0;
        [open, close] = [a, b];
      } else close = Math.max(close, b);
    }
    return total + (close - open > 0 && Number.isFinite(open) ? close - open : 0);
  }
}
