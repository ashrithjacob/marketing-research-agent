import type { RunSummary, Usage } from './runs';

export interface RunEvent {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** One content block of a message, as pi-ai shapes it. */
export interface ContentBlock {
  type: 'text' | 'thinking' | 'toolCall' | 'image' | string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
}

/** A message as the model received it (a tool result's `details` removed). */
export interface TraceMessage {
  role: 'user' | 'assistant' | 'toolResult';
  content: string | ContentBlock[];
  toolName?: string;
  toolCallId?: string;
  isError?: boolean;
  stopReason?: string;
}

/** One LLM call; `input` holds only what is new since the previous call (workings.md §5). */
export interface LlmCall {
  id: number;
  seq: number;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  model: string;
  system_prompt: string | null;
  tools: Array<{ name: string; description: string; parameters: unknown }> | null;
  context_reset: boolean;
  context_messages: number;
  input: TraceMessage[];
  output: {
    content?: ContentBlock[];
    responseId?: string;
    responseModel?: string;
    stopReason?: string;
    errorMessage?: string;
  };
  stop_reason: string;
  error: string;
  usage: Usage;
  response_id: string;
  billed_cost: number | null;
}

export interface CallStats {
  llm_calls: number;
  llm_errors: number;
  tokens: { input: number; output: number; cache_read: number; cache_write: number; total: number };
  cost: number;
  billed: { total: number; resolved: number };
  /** Apify actor charges (crawler usage + pay-per-event); absent from servers that predate it. */
  apify?: { total: number; runs: number };
  llm_time_ms: number;
  wall_time_ms: number;
  tool_calls: number;
  tool_errors: number;
}

export interface CallsResponse {
  run: RunSummary & { live: boolean };
  stats: CallStats;
  calls: LlmCall[];
}
