import type { GenerationSource, LlmCall, ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Looks up what each service billed once its bill exists: OpenRouter's lookup 404s for a few seconds after a turn, Apify adds its charges seconds after a run. Each lookup is kept pending until the run ends and waits for it. */
export class BilledCosts {
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly store: ResearchStore,
    private readonly source: GenerationSource,
  ) {}

  readonly onCall = (call: LlmCall): void => {
    Trace.line(import.meta.url, "BilledCosts.onCall", { runId: call.run_id, seq: call.seq });
    if (!this.source.billable || !call.response_id) return;
    const work = this.record(call).catch((error: unknown) => console.error(`run ${call.run_id}: billed cost lookup failed`, error));
    this.pending.add(work);
    void work.finally(() => this.pending.delete(work));
  };

  /** Keeps another service's billing lookup pending the same way. */
  readonly defer = (work: Promise<void>): void => {
    Trace.line(import.meta.url, "BilledCosts.defer", { pending: this.pending.size });
    const tracked = work.catch((error: unknown) => console.error("billed cost lookup failed", error));
    this.pending.add(tracked);
    void tracked.finally(() => this.pending.delete(tracked));
  };

  async settled(): Promise<void> {
    Trace.line(import.meta.url, "BilledCosts.settled", { pending: this.pending.size });
    await Promise.all([...this.pending]);
  }

  private async record(call: LlmCall): Promise<void> {
    Trace.line(import.meta.url, "BilledCosts.record", { responseId: call.response_id });
    const generation = await this.source.generation(call.response_id);
    if (!generation) return;
    await this.store.calls.setGeneration(call.run_id, call.response_id, generation);
    await this.store.charges.add({
      run_id: call.run_id,
      agent_id: call.agent_id,
      service: "openrouter",
      item: generation.model || call.model,
      units: 1,
      usd: generation.cost,
      basis: "billed",
    });
  }
}
