import type { ResearchRun } from "../../domain/index.js";

/** Reads SQLite rows back into domain records; a bad JSON column becomes a default. */
export class Rows {
  static json(raw: string, fallback: unknown): unknown {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  static run(row: Record<string, any>): ResearchRun {
    return {
      id: row.id,
      agent_run_id: row.agent_run_id ?? "",
      session_id: row.session_id,
      stage: row.stage,
      status: row.status,
      model: row.model,
      brief: Rows.json(row.brief, {}) as Record<string, unknown>,
      reject_kinds: Rows.json(row.reject_kinds, []) as string[],
      judgement_ids: Rows.json(row.judgement_ids, []) as string[],
      nodes: Rows.json(row.nodes, []) as string[],
      packet: row.packet ? (Rows.json(row.packet, null) as Record<string, unknown> | null) : null,
      packet_source: row.packet_source ?? "",
      error: row.error,
      output: row.output,
      usage: Rows.json(row.usage, {}) as Record<string, unknown>,
      created_at: row.created_at,
      updated_at: row.updated_at,
      ended_at: row.ended_at,
    };
  }
}
