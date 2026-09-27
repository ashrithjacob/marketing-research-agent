import type { Generation, LlmCall, ResearchStore } from "../domain/index.js";

import { Frames } from "./frames.js";
import type { LiveRuns } from "./live-runs.js";
import { Trace } from "../trace/index.js";

/** A call's OpenRouter generation record and its log row arrive independently; whichever lands second attaches it. */
export class BilledCosts {
  private readonly generations = new Map<string, Generation>();

  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly runId: string,
  ) {}

  readonly attach = (responseId: string, generation: Generation): void => {
    Trace.line(import.meta.url, "BilledCosts.attach", { responseId, generation });
    this.generations.set(responseId, generation);
    this.store.setLlmCallGeneration(this.runId, responseId, generation);
  };

  readonly onCall = (call: LlmCall): void => {
    Trace.line(import.meta.url, "BilledCosts.onCall", { call });
    const generation = this.generations.get(call.response_id);
    if (generation !== undefined) this.store.setLlmCallGeneration(this.runId, call.response_id, generation);
    this.runs.emit(this.runId, "llm.call", Frames.callSummary(call));
  };
}
