import type { LlmCall, ResearchRun, RunEvent } from "../domain/index.js";

/** The log page's header, summed from recorded rows so it can only undercount a run. */
export class CallStats {
  static of(
    run: ResearchRun,
    calls: readonly LlmCall[],
    events: readonly RunEvent[],
    live: boolean,
  ): Record<string, unknown> {
    const sum = (pick: (call: LlmCall) => number | undefined) =>
      calls.reduce((total, call) => total + (pick(call) ?? 0), 0);
    const usage = (call: LlmCall) => call.usage as Record<string, any>;
    const billed = calls.filter((call) => call.billed_cost !== null);
    const toolEnds = events.filter((e) => e.kind === "tool.completed");
    const start = Date.parse(run.created_at);
    const end = run.ended_at
      ? Date.parse(run.ended_at)
      : live
        ? Date.now()
        : Date.parse(run.updated_at);
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
      cost: sum((call) => usage(call).cost?.total),
      billed: {
        total: billed.reduce((total, call) => total + (call.billed_cost ?? 0), 0),
        resolved: billed.length,
      },
      llm_time_ms: sum((call) => call.duration_ms),
      wall_time_ms: Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0,
      tool_calls: toolEnds.length,
      tool_errors: toolEnds.filter((e) => e.payload.error === true).length,
    };
  }
}
