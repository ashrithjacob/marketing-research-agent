import type { LlmCall, ResearchStore } from "../domain/index.js";

import { Frames } from "./frames.js";
import type { LiveRuns } from "./live-runs.js";

/** A call's billed cost and its log row arrive independently; whichever lands second attaches the cost. */
export class BilledCosts {
  private readonly billed = new Map<string, number>();

  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly runId: string,
  ) {}

  readonly attach = (responseId: string, cost: number): void => {
    this.billed.set(responseId, cost);
    this.store.setLlmCallBilled(this.runId, responseId, cost);
  };

  readonly onCall = (call: LlmCall): void => {
    const cost = this.billed.get(call.response_id);
    if (cost !== undefined) this.store.setLlmCallBilled(this.runId, call.response_id, cost);
    this.runs.emit(this.runId, "llm.call", Frames.callSummary(call));
  };
}
