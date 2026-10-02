import type { StreamFn } from "@earendil-works/pi-agent-core";
import { getCurrentSystemPrompt, getCurrentTools, type AssistantMessage, type Message } from "@earendil-works/pi-ai";

import type { LlmCall, ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";
import { UsageTotals } from "./usage.js";

/** Numbers a run's LLM calls across all of its agents. */
export class CallSequence {
  private last = 0;

  next(): number {
    Trace.line(import.meta.url, "CallSequence.next", { last: this.last });
    this.last += 1;
    return this.last;
  }
}

/** Wraps one agent's streamFn so every LLM call is stored as sent and as answered, under that agent's id. */
export class LlmCallLog {
  private previous: readonly Message[] = [];
  private lastSystem: string | undefined;
  private lastTools: string | undefined;

  constructor(
    private readonly options: {
      runId: string;
      agentId: string;
      sequence: CallSequence;
      store: ResearchStore;
      onCall?: (call: LlmCall) => void;
    },
  ) {}

  wrap(inner: StreamFn): StreamFn {
    Trace.line(import.meta.url, "LlmCallLog.wrap", { inner });
    return async (model, context, streamOptions) => {
      const n = this.options.sequence.next();
      const started = Date.now();

      const messages = context.messages.filter((m) => m.role !== "system");
      let prefix = 0;
      while (
        prefix < this.previous.length &&
        prefix < messages.length &&
        messages[prefix] === this.previous[prefix]
      ) {
        prefix++;
      }
      const reset = prefix < this.previous.length;
      const input = JSON.parse(
        JSON.stringify((reset ? messages : messages.slice(prefix)).map(LlmCallLog.asSent)),
      ) as unknown[];
      this.previous = [...messages];

      const systemPrompt = getCurrentSystemPrompt(context.messages);
      const system = systemPrompt !== this.lastSystem ? systemPrompt : null;
      this.lastSystem = systemPrompt;

      const toolList = getCurrentTools(context.messages).map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));
      const toolsKey = JSON.stringify(toolList);
      const tools = toolsKey !== this.lastTools ? (JSON.parse(toolsKey) as unknown[]) : null;
      this.lastTools = toolsKey;

      const record = (message: AssistantMessage | undefined, failure?: unknown) => {
        try {
          const ended = Date.now();
          const { usage, ...answer } = message ?? ({} as Partial<AssistantMessage>);
          const call = this.options.store.addLlmCall({
            run_id: this.options.runId,
            seq: n,
            agent_id: this.options.agentId,
            started_at: new Date(started).toISOString(),
            ended_at: new Date(ended).toISOString(),
            duration_ms: ended - started,
            model: message?.responseModel || message?.model || model.id,
            system_prompt: system,
            tools,
            context_reset: reset,
            context_messages: messages.length,
            input,
            output: answer,
            stop_reason: message?.stopReason ?? "error",
            error:
              message?.errorMessage ??
              (failure === undefined
                ? ""
                : failure instanceof Error
                  ? failure.message
                  : String(failure)),
            usage: UsageTotals.tokens(usage ?? {}) as unknown as Record<string, unknown>,
            response_id: message?.responseId ?? "",
          });
          this.options.onCall?.(call);
        } catch (error) {
          console.error(
            `research run ${this.options.runId}: recording LLM call ${n} failed`,
            error,
          );
        }
      };

      let stream: Awaited<ReturnType<StreamFn>>;
      try {
        stream = await inner(model, context, streamOptions);
      } catch (error) {
        record(undefined, error);
        throw error;
      }
      stream.result().then(
        (message) => record(message),
        (error) => record(undefined, error),
      );
      return stream;
    };
  }

  private static asSent(message: Message): unknown {
    Trace.line(import.meta.url, "LlmCallLog.asSent", { message });
    if (message.role !== "toolResult") return message;
    const { details: _details, usage: _usage, ...sent } = message;
    return sent;
  }
}
