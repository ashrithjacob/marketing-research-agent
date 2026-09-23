import type { StagePacket } from "./packet.js";
import type { SourceKind } from "./vocabulary.js";

export const RUN_STATUSES = [
  "queued",
  "running",
  "stopping",
  "completed",
  "invalid",
  "failed",
  "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "invalid",
  "failed",
  "cancelled",
]);

export interface RunEvent {
  id: number;
  run_id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Judgement {
  id: string;
  kind: string;
  text: string;
  rejects_kinds: SourceKind[];
  active: boolean;
  applied_count: number;
  created_at: string;
}

export interface PacketCheck {
  id: number;
  run_id: string;
  seq: number;
  valid: boolean;
  problems: string[];
  created_at: string;
}

export interface RunUpdate {
  agent_run_id?: string;
  session_id?: string;
  stage?: number;
  status?: string;
  model?: string;
  brief?: unknown;
  reject_kinds?: unknown;
  judgement_ids?: unknown;
  packet?: StagePacket | Record<string, unknown> | string;
  error?: string;
  output?: string;
  usage?: unknown;
  ended_at?: string;
  packet_source?: "tool" | "output" | "";
}

export interface LlmCallRecord {
  run_id: string;
  seq: number;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  model: string;
  system_prompt: string | null;
  tools: unknown[] | null;
  context_reset: boolean;
  context_messages: number;
  input: unknown[];
  output: unknown;
  stop_reason: string;
  error: string;
  usage: Record<string, unknown>;
  response_id: string;
}

export interface LlmCall extends LlmCallRecord {
  id: number;
  billed_cost: number | null;
}
