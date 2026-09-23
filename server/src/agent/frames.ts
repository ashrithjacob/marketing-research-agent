import type { Usage } from "@earendil-works/pi-ai";

import type { LlmCall } from "../domain/index.js";

export interface EventFrame {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** What the cockpit is told about a tool call and an LLM turn. */
export class Frames {
  static toolPreview(toolName: string, args: unknown): string {
    const fields = (args ?? {}) as Record<string, unknown>;
    if (toolName === "web_search") return String(fields.query ?? "");
    if (toolName === "web_fetch") return String(fields.url ?? "");
    return "";
  }

  static callSummary(call: LlmCall): Record<string, unknown> {
    const usage = call.usage as Partial<Usage>;
    const content = (call.output as { content?: Array<{ type?: string }> }).content ?? [];
    return {
      seq: call.seq,
      duration_ms: call.duration_ms,
      input_tokens: usage.input ?? 0,
      output_tokens: usage.output ?? 0,
      cache_read_tokens: usage.cacheRead ?? 0,
      cost: usage.cost?.total ?? 0,
      stop_reason: call.stop_reason,
      tool_calls: content.filter((item) => item?.type === "toolCall").length,
      error: call.error,
    };
  }
}
