/**
 * Every LLM call a run makes, as the model saw it and as it answered.
 *
 * Recorded by wrapping the agent's `streamFn` rather than by reading agent
 * events. Events describe the conversation; the stream function is the one
 * place that sees the exact `Context` handed to the provider — system prompt,
 * tool list and messages — and the exact message that came back, error
 * responses included. Nothing reconstructed, so the log page cannot drift from
 * what was actually sent.
 *
 * Storage is incremental (see `LlmCallRecord` in `store.ts`): the agent only
 * appends to its context, so each call stores the messages that are new since
 * the previous call, and the full prompt of call N is calls 1..N concatenated.
 * pi-agent-core's default `convertToLlm` filters the transcript without copying
 * it, so "unchanged" is checked by object identity — cheap, and exact. A context
 * that is not an extension of the last one is stored whole and flagged.
 */

import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Message } from "@earendil-works/pi-ai";

import type { LlmCall, ResearchStore } from "./domain/index.js";

/**
 * A message as the provider receives it. A tool result's `details` and `usage`
 * are for the application and are never sent to the model, so they are left
 * out: the trace is of what the model saw, and `details` can double its size.
 */
function asSent(message: Message): unknown {
  if (message.role !== "toolResult") return message;
  const { details: _details, usage: _usage, ...sent } = message;
  return sent;
}

export function recordLlmCalls(
  inner: StreamFn,
  options: {
    runId: string;
    store: ResearchStore;
    /** Called once a call is stored. Never allowed to break the run. */
    onCall?: (call: LlmCall) => void;
  },
): StreamFn {
  const { runId, store, onCall } = options;
  let seq = 0;
  let previous: readonly Message[] = [];
  let lastSystem: string | undefined;
  let lastTools: string | undefined;

  return async (model, context, streamOptions) => {
    const n = ++seq;
    const started = Date.now();

    const messages = context.messages;
    let prefix = 0;
    while (
      prefix < previous.length &&
      prefix < messages.length &&
      messages[prefix] === previous[prefix]
    ) {
      prefix++;
    }
    const reset = prefix < previous.length;
    // Serialised now, not when the answer lands: this is the request as sent.
    const input = JSON.parse(
      JSON.stringify((reset ? messages : messages.slice(prefix)).map(asSent)),
    ) as unknown[];
    previous = [...messages];

    const systemPrompt = context.systemPrompt ?? "";
    const system = systemPrompt !== lastSystem ? systemPrompt : null;
    lastSystem = systemPrompt;

    const toolList = (context.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    const toolsKey = JSON.stringify(toolList);
    const tools = toolsKey !== lastTools ? (JSON.parse(toolsKey) as unknown[]) : null;
    lastTools = toolsKey;

    const record = (message: AssistantMessage | undefined, failure?: unknown) => {
      try {
        const ended = Date.now();
        const { usage, ...answer } = message ?? ({} as Partial<AssistantMessage>);
        const call = store.addLlmCall({
          run_id: runId,
          seq: n,
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
            (failure === undefined ? "" : failure instanceof Error ? failure.message : String(failure)),
          usage: (usage ?? {}) as unknown as Record<string, unknown>,
          response_id: message?.responseId ?? "",
        });
        onCall?.(call);
      } catch (error) {
        // A trace that fails to write loses a log row, never the run.
        console.error(`research run ${runId}: recording LLM call ${n} failed`, error);
      }
    };

    let stream: Awaited<ReturnType<StreamFn>>;
    try {
      stream = await inner(model, context, streamOptions);
    } catch (error) {
      record(undefined, error);
      throw error;
    }
    // `result()` resolves on the stream's final event independently of whoever
    // is iterating it, so observing it here takes nothing from the agent.
    stream.result().then(
      (message) => record(message),
      (error) => record(undefined, error),
    );
    return stream;
  };
}