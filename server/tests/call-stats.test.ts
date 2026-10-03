/**
 * The logs page header, per agent. Agents run side by side, so the run's model
 * time is time with any call in flight, not the sum of every call.
 */
import { describe, expect, it } from "vitest";

import type { LlmCall, ResearchRun, RunEvent } from "../src/domain/index.js";
import { CallStats } from "../src/http/call-stats.js";

const at = (s: number) => new Date(Date.UTC(2026, 9, 3, 7, 0, s)).toISOString();
const call = (agent_id: string, start: number, seconds: number, billed: number | null) =>
  ({ agent_id, started_at: at(start), duration_ms: seconds * 1000, error: "", usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens: 15 }, billed_cost: billed }) as unknown as LlmCall;
const event = (kind: string, agent_id: string, s: number, extra: Record<string, unknown> = {}) =>
  ({ kind, created_at: at(s), payload: { agent_id, ...extra } }) as unknown as RunEvent;

describe("CallStats", () => {
  const run = { id: "r", created_at: at(0), ended_at: at(100), updated_at: at(100) } as ResearchRun;
  const calls = [call("product", 10, 30, 0.01), call("category", 20, 30, null), call("category", 60, 10, 0.02)];
  const events = [
    event("agent.started", "product", 10), event("tool.completed", "product", 41, { error: true }), event("agent.ended", "product", 45),
    event("agent.started", "category", 20), event("agent.ended", "category", 75),
  ];

  it("gives each agent its own calls, tools, billed cost and time from its start to its end", () => {
    const stats = CallStats.of(run, calls, events, false) as any;
    expect(stats.agents.product).toMatchObject({ llm_calls: 1, wall_time_ms: 35_000, llm_time_ms: 30_000, tool_calls: 1, tool_errors: 1, billed: { total: 0.01, resolved: 1 }, open: false });
    expect(stats.agents.category).toMatchObject({ llm_calls: 2, wall_time_ms: 55_000, llm_time_ms: 40_000, billed: { total: 0.02, resolved: 1 } });
  });

  it("counts the run's model time once where agents overlap", () => {
    // product 10–40s and category 20–50s overlap; with category 60–70s that is 50s, not 70.
    expect((CallStats.of(run, calls, events, false) as any).llm_time_ms).toBe(50_000);
  });

  it("keeps an agent that has not ended open, so the page can keep its clock running", () => {
    const live = { ...run, ended_at: "" } as ResearchRun;
    expect((CallStats.of(live, calls, events.slice(0, 4), true) as any).agents.category.open).toBe(true);
  });
});
