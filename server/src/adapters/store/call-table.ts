import type { CallLog, Generation, LlmCall, LlmCallRecord } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** Every LLM call a run's agents made, as sent and as answered, numbered across the run. */
export class CallTable implements CallLog {
  constructor(private readonly db: SqlDatabase) {}

  async add(call: LlmCallRecord): Promise<LlmCall> {
    Trace.line(import.meta.url, "CallTable.add", { runId: call.run_id, seq: call.seq });
    const row = await this.db.get<{ id: number }>(
      "INSERT INTO llm_calls (run_id, seq, agent_id, started_at, ended_at, duration_ms, model, system_prompt, tools," +
        " context_reset, context_messages, input, output, stop_reason, error, usage, response_id)" +
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
      [
        call.run_id,
        call.seq,
        call.agent_id,
        call.started_at,
        call.ended_at,
        call.duration_ms,
        call.model,
        call.system_prompt,
        call.tools === null ? null : JSON.stringify(call.tools),
        call.context_reset,
        call.context_messages,
        JSON.stringify(call.input),
        JSON.stringify(call.output ?? {}),
        call.stop_reason,
        call.error,
        JSON.stringify(call.usage ?? {}),
        call.response_id,
      ],
    );
    return { ...call, id: row!.id, billed_cost: null, generation: null };
  }

  async setGeneration(runId: string, responseId: string, generation: Generation): Promise<void> {
    Trace.line(import.meta.url, "CallTable.setGeneration", { runId, responseId });
    await this.db.run("UPDATE llm_calls SET billed_cost = ?, generation = ? WHERE run_id = ? AND response_id = ?", [
      generation.cost,
      JSON.stringify(generation),
      runId,
      responseId,
    ]);
  }

  async list(runId: string): Promise<LlmCall[]> {
    Trace.line(import.meta.url, "CallTable.list", { runId });
    return this.db.all<LlmCall>("SELECT * FROM llm_calls WHERE run_id = ? ORDER BY seq", [runId]);
  }
}
