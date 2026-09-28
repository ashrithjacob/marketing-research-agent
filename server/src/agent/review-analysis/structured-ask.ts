import type { AssistantMessage, Models, TSchema, Tool, Usage } from "@earendil-works/pi-ai";
import type { z } from "zod";

import { Trace } from "../../trace/index.js";

import type { ModelChain } from "../model-chain.js";

/** One model call whose only allowed answer is a single forced tool call, validated against a zod schema. */
export class StructuredAsk {
  static readonly ATTEMPTS = 3;
  static readonly DEADLINE_SECONDS = 120;

  constructor(
    private readonly models: Models,
    private readonly chain: ModelChain,
    private readonly maxTokens: number,
  ) {}

  async ask<T>(
    request: { system: string; user: string; tool: Tool<TSchema>; schema: z.ZodType<T> },
    onUsage: (usage: Usage) => void,
  ): Promise<T> {
    Trace.line(import.meta.url, "StructuredAsk.ask", { tool: request.tool.name });
    let problem = "";
    const sequence = this.chain.sequence;
    for (let attempt = 1; attempt <= StructuredAsk.ATTEMPTS; attempt++) {
      const started = Date.now();
      const reply = await this.models.completeSimple(
        sequence[Math.min(attempt - 1, sequence.length - 1)]!,
        {
          systemPrompt: request.system,
          messages: [{ role: "user", content: request.user, timestamp: Date.now() }],
          tools: [request.tool],
        },
        {
          maxTokens: this.maxTokens,
          temperature: 0,
          reasoning: "low",
          signal: AbortSignal.timeout(StructuredAsk.DEADLINE_SECONDS * 1000),
          onPayload: this.chain.withFallbacks(StructuredAsk.forceTool(request.tool.name)),
        },
      );
      onUsage(reply.usage);
      StructuredAsk.replied(request.tool.name, attempt, reply, (Date.now() - started) / 1000);
      if (reply.stopReason === "error" || reply.stopReason === "aborted") {
        problem = reply.errorMessage ?? reply.stopReason;
        continue;
      }
      const call = reply.content.find((part) => part.type === "toolCall" && part.name === request.tool.name);
      const parsed = request.schema.safeParse(call?.type === "toolCall" ? call.arguments : undefined);
      if (parsed.success) return parsed.data;
      problem = call ? parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") : `no ${request.tool.name} call (stop: ${reply.stopReason})`;
    }
    throw new Error(`${request.tool.name}: ${problem}`);
  }

  private static replied(tool: string, attempt: number, reply: AssistantMessage, seconds: number): void {
    Trace.line(import.meta.url, "StructuredAsk.replied", {
      tool,
      attempt,
      stop: reply.stopReason,
      model: reply.responseModel ?? reply.model,
      output: reply.usage.output,
      reasoning: reply.usage.reasoning,
      seconds,
    });
  }

  private static forceTool(name: string) {
    Trace.line(import.meta.url, "StructuredAsk.forceTool", { name });
    return (payload: unknown) => ({
      ...(payload as Record<string, unknown>),
      tool_choice: { type: "function", function: { name } },
    });
  }
}
