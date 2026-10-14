import type { Node, Trip } from "../domain/index.js";
import type { DeliverableCheck } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { DoneCheck } from "./done-check.js";
import { PartClose } from "./part-close.js";
import type { RowRepair } from "./row-repair.js";
import type { RunFindings } from "./run-findings.js";

export interface LimitClosed {
  gapped: string[];
  retracted: string[];
}

/** Closes an agent a breaker ended, with no turn left to repair: its own rows that break its check are retracted with a gap each, everything its deliverable still lacks is gapped with why it stopped, and a part that reports its status and left none is marked incomplete. */
export class LimitClose {
  constructor(
    private readonly findings: RunFindings,
    private readonly repair: RowRepair,
    private readonly check: DoneCheck,
    private readonly deliverable: DeliverableCheck,
    private readonly part: { node: Node; reports: boolean },
  ) {}

  async close(trip: Trip): Promise<LimitClosed> {
    Trace.line(import.meta.url, "LimitClose.close", { node: this.part.node, breaker: trip.breaker });
    const retracted = await this.repair.repair(() => this.check.problems(), trip.at, this.findings.agentId);
    const gapped = await new PartClose(this.findings, this.deliverable, this.part).close(trip);
    return { gapped, retracted };
  }
}
