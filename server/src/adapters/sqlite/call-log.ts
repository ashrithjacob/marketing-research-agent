import type Database from "better-sqlite3";

import type { LlmCall, LlmCallRecord } from "../../domain/index.js";

import { Rows } from "./rows.js";

export class CallLog {
  constructor(private readonly db: Database.Database) {}

  add(call: LlmCallRecord): LlmCall {
    const info = this.db
      .prepare(
        "INSERT INTO research_llm_calls (run_id, seq, started_at, ended_at, duration_ms," +
          " model, system_prompt, tools, context_reset, context_messages, input, output," +
          " stop_reason, error, usage, response_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
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
      );
    return { ...call, id: Number(info.lastInsertRowid), billed_cost: null };
  }

  setBilled(runId: string, responseId: string, cost: number): void {
    this.db
      .prepare("UPDATE research_llm_calls SET billed_cost = ? WHERE run_id = ? AND response_id = ?")
      .run(cost, runId, responseId);
  }

  list(runId: string): LlmCall[] {
    const rows = this.db
      .prepare("SELECT * FROM research_llm_calls WHERE run_id = ? ORDER BY seq")
      .all(runId) as Array<Record<string, any>>;
    return rows.map((row) => ({
      id: row.id as number,
      run_id: row.run_id as string,
      seq: row.seq as number,
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
    }));
  }
}
