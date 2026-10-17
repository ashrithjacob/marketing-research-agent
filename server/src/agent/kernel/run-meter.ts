import type { ChargeDraft, ChargeLedger, ChargeMeter } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Writes each paid call against the run and the agent whose tool made it. */
export class RunMeter implements ChargeMeter {
  constructor(
    private readonly ledger: ChargeLedger,
    private readonly runId: string,
    private readonly agentId: string | null,
  ) {}

  async charge(draft: ChargeDraft): Promise<void> {
    Trace.line(import.meta.url, "RunMeter.charge", { service: draft.service, item: draft.item, agentId: this.agentId });
    await this.ledger.add({ ...draft, run_id: this.runId, agent_id: this.agentId });
  }
}
