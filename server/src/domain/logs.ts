export interface RunEvent {
  id: number;
  run_id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface LlmCallRecord {
  run_id: string;
  seq: number;
  agent_id: string;
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

/** What OpenRouter recorded for one generation: its charge, and where its time went. */
export interface Generation {
  model: string;
  cost: number | null;
  latency_ms: number | null;
  generation_ms: number | null;
  reasoning_tokens: number | null;
  provider: string;
}

export interface LlmCall extends LlmCallRecord {
  id: number;
  billed_cost: number | null;
  generation: Generation | null;
}
