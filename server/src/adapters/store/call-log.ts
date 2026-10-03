
import type { Generation, LlmCall, LlmCallRecord } from "../../domain/index.js";

import { Rows } from "./rows.js";
import type { SqlDatabase } from "./sql-database.js";
import { Trace } from "../../trace/index.js";

/** Every LLM call a run's agents made, as sent and as answered, numbered across the run. */
export class CallLog {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_llm_calls (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id           TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    seq              INTEGER NOT NULL,
    started_at       TEXT NOT NULL,
    ended_at         TEXT NOT NULL,
    duration_ms      INTEGER NOT NULL,
    model            TEXT NOT NULL DEFAULT '',
    system_prompt    TEXT,
    tools            TEXT,
    context_reset    INTEGER NOT NULL DEFAULT 0,
    context_messages INTEGER NOT NULL DEFAULT 0,
    input            TEXT NOT NULL DEFAULT '[]',
    output           TEXT NOT NULL DEFAULT '{}',
    stop_reason      TEXT NOT NULL DEFAULT '',
    error            TEXT NOT NULL DEFAULT '',
    usage            TEXT NOT NULL DEFAULT '{}',
    response_id      TEXT NOT NULL DEFAULT '',
    agent_id         TEXT NOT NULL DEFAULT '',
    billed_cost      REAL,
    generation       TEXT
);
CREATE INDEX IF NOT EXISTS idx_research_llm_calls_run
    ON research_llm_calls(run_id, seq);
`;

  constructor(private readonly db: SqlDatabase) {}

  async add(call: LlmCallRecord): Promise<LlmCall> {
    Trace.line(import.meta.url, "CallLog.add", { call });
    const row = await this.db.get<{ id: number }>(
      "INSERT INTO research_llm_calls (run_id, seq, started_at, ended_at, duration_ms," +
        " model, system_prompt, tools, context_reset, context_messages, input, output," +
        " stop_reason, error, usage, response_id, agent_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
      [
        call.run_id,
        call.seq,
        call.started_at,
        call.ended_at,
        call.duration_ms,
        call.model,
        call.system_prompt,
        call.tools === null ? null : JSON.stringify(call.tools),
        call.context_reset ? 1 : 0,
        call.context_messages,
        JSON.stringify(call.input),
        JSON.stringify(call.output ?? {}),
        call.stop_reason,
        call.error,
        JSON.stringify(call.usage ?? {}),
        call.response_id,
        call.agent_id,
      ],
    );
    return { ...call, id: row!.id, billed_cost: null, generation: null };
  }

  async setGeneration(runId: string, responseId: string, generation: Generation): Promise<void> {
    Trace.line(import.meta.url, "CallLog.setGeneration", { runId, responseId, generation });
    await this.db.run(
      "UPDATE research_llm_calls SET billed_cost = ?, generation = ? WHERE run_id = ? AND response_id = ?",
      [generation.cost, JSON.stringify(generation), runId, responseId],
    );
  }

  async list(runId: string): Promise<LlmCall[]> {
    Trace.line(import.meta.url, "CallLog.list", { runId });
    const rows = await this.db.all("SELECT * FROM research_llm_calls WHERE run_id = ? ORDER BY seq", [runId]);
    return rows.map((row) => ({
      id: row.id as number,
      run_id: row.run_id as string,
      seq: row.seq as number,
      agent_id: row.agent_id as string,
      started_at: row.started_at as string,
      ended_at: row.ended_at as string,
      duration_ms: row.duration_ms as number,
      model: row.model as string,
      system_prompt: (row.system_prompt as string | null) ?? null,
      tools: row.tools === null ? null : (Rows.json(row.tools, []) as unknown[]),
      context_reset: Boolean(row.context_reset),
      context_messages: row.context_messages as number,
      input: Rows.json(row.input, []) as unknown[],
      output: Rows.json(row.output, {}),
      stop_reason: row.stop_reason as string,
      error: row.error as string,
      usage: Rows.json(row.usage, {}) as Record<string, unknown>,
      response_id: row.response_id as string,
      billed_cost: (row.billed_cost as number | null) ?? null,
      generation: Rows.json(row.generation, null) as Generation | null,
    }));
  }
}
