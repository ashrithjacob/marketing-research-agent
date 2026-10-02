import type { ChargeDraft, ChargeMeter, ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";

/** Records each charge against its run and the agent that caused it, or none when code spent it, and tells the cockpit. */
export class RunMeter implements ChargeMeter {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly runId: string,
    private readonly agentId: string | null,
  ) {}

  charge(draft: ChargeDraft): void {
    Trace.line(import.meta.url, "RunMeter.charge", { agentId: this.agentId, service: draft.service, units: draft.units });
    const charge = this.store.charges.add({ ...draft, run_id: this.runId, agent_id: this.agentId });
    this.runs.emit(this.runId, "run.charged", { ...charge });
  }
}
