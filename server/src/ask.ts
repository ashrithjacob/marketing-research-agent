/**
 * One question, one answer, no tools.
 *
 * Stage 0's MRR judgement is not agentic — it reads a list and returns a score
 * per row — so it gets an `Agent` with an empty tool array rather than anything
 * that could fetch. Same harness as `runner.ts`, which is the point: the faux
 * provider in the tests drives both, and there is one place where assistant text
 * is accumulated.
 *
 * Text is collected per message rather than per delta for the reason spelled out
 * in `runner.ts`: the agent re-emits the whole message on each update, so
 * appending deltas multiplies the output by the number of updates.
 */

import { Agent, type AgentEvent } from "@earendil-works/pi-agent-core";
import type { Models } from "@earendil-works/pi-ai";

import type { Ask } from "./stage0.js";

export class AskError extends Error {
  override readonly name = "AskError";
}

/**
 * An `Ask` bound to one model.
 *
 * `sessionId` is stable per scoring run so a cache-aware backend keeps the
 * rubric's prefix warm across batches — the rubric is the bulk of each prompt
 * and it is identical every time.
 */
export function createAgentAsk(options: {
  models: Models;
  modelId: string;
  provider?: string;
  sessionId: string;
}): Ask {
  const { models, modelId, provider = "openrouter", sessionId } = options;

  return async function ask(system, instructions, signal) {
    const model = models.getModel(provider, modelId);
    if (!model) {
      throw new AskError(`unknown model ${JSON.stringify(modelId)} for provider ${provider}`);
    }

    const agent = new Agent({
      streamFn: (m, c, o) => models.streamSimple(m, c, o),
      sessionId,
      initialState: { systemPrompt: system, model, tools: [] },
    });

    // Only finished messages, so nothing is counted twice.
    const finished: string[] = [];
    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      if (event.type !== "message_end") return;
      const message = event.message as any;
      if (message?.role !== "assistant") return;
      finished.push(
        (message.content ?? [])
          .filter((c: any) => c?.type === "text")
          .map((c: any) => c.text ?? "")
          .join(""),
      );
    });

    const abort = () => agent.abort();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      await agent.prompt(instructions);
      await agent.waitForIdle();
      if (agent.state.errorMessage) throw new AskError(agent.state.errorMessage);
      return finished.join("\n");
    } finally {
      signal?.removeEventListener("abort", abort);
      unsubscribe();
    }
  };
}
