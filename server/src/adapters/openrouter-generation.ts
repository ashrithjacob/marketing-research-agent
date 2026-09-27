import type { Generation } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Reads OpenRouter's `/generation` record into the fields the call log keeps. */
export class OpenRouterGeneration {
  static parse(data: Record<string, unknown>): Generation {
    Trace.line(import.meta.url, "OpenRouterGeneration.parse", { data });
    return {
      cost: OpenRouterGeneration.number(data.total_cost),
      latency_ms: OpenRouterGeneration.number(data.latency),
      generation_ms: OpenRouterGeneration.number(data.generation_time),
      reasoning_tokens: OpenRouterGeneration.number(data.native_tokens_reasoning),
      provider: typeof data.provider_name === "string" ? data.provider_name : "",
    };
  }

  private static number(value: unknown): number | null {
    Trace.line(import.meta.url, "OpenRouterGeneration.number", { value });
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
}
