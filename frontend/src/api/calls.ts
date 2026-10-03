import type { RunSummary, Usage } from './runs';

export interface RunEvent {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** One trace line written while a tool call ran: a function it called, or a request it sent. */
export interface ToolStep {
  at: string;
  file: string;
  name: string;
  fields: string;
}

/** What an outside service said about one request beyond its HTTP status, e.g. which search engines answered. */
export interface ServiceReport {
  service: string;
  outcome: 'ok' | 'degraded' | 'failed';
  parts: Array<{ name: string; ok: boolean; detail: string }>;
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

/** What OpenRouter recorded for one call: its charge, and where its time went. */
export interface Generation {
  model: string;
  cost: number | null;
  latency_ms: number | null;
  generation_ms: number | null;
  reasoning_tokens: number | null;
  provider: string;
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
  generation: Generation | null;
}

/** One window of a run — the whole run, or one agent from its start to its end. */
export interface WindowStats {
  llm_calls: number;
  llm_errors: number;
  tokens: { input: number; output: number; cache_read: number; cache_write: number; total: number };
  billed: { total: number; resolved: number };
  llm_time_ms: number;
  wall_time_ms: number;
  tool_calls: number;
  tool_errors: number;
  /** When the window began; `open` while it has not ended, so the page can keep counting. */
  started_at: string;
  open: boolean;
}

export interface CallStats extends WindowStats {
  /** Each agent's own calls, tools and time, keyed by agent id. */
  agents: Record<string, WindowStats>;
}

export interface CallsResponse {
  run: RunSummary & { live: boolean };
  stats: CallStats;
  calls: LlmCall[];
}
