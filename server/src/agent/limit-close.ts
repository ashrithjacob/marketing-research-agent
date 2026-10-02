import type { Node } from "../domain/index.js";
import type { DeliverableCheck } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { DoneCheck } from "./done-check.js";
import type { RowRepair } from "./row-repair.js";
import type { RunFindings } from "./run-findings.js";

export interface LimitClosed {
  gapped: string[];
  retracted: string[];
}

/** Closes an agent its turn limit ended, with no turn left to repair: its own rows that break its check are retracted with a gap each, everything its deliverable still lacks is gapped, and a part that reports its status and left none is marked incomplete. */
export class LimitClose {
  constructor(
    private readonly findings: RunFindings,
    private readonly repair: RowRepair,
    private readonly check: DoneCheck,
    private readonly deliverable: DeliverableCheck,
    private readonly part: { node: Node; limit: number; reports: boolean },
  ) {}

  close(): LimitClosed {
    Trace.line(import.meta.url, "LimitClose.close", { node: this.part.node, limit: this.part.limit });
    const retracted = this.repair.repair(() => this.check.problems(), `at the ${this.part.limit}-turn limit`, this.findings.agentId);
    return { gapped: this.gapOpen(), retracted };
  }

  private gapOpen(): string[] {
    Trace.line(import.meta.url, "LimitClose.gapOpen", { node: this.part.node });
    const { findings } = this;
    const { node, limit, reports } = this.part;
    const why = `not found within the ${limit}-turn limit`;
    const open = this.deliverable.missing(findings.live()).filter((missing) => !missing.row).map((missing) => missing.key);
    for (const key of open) findings.record("gap", { node, missing: `${key}: ${why}`, would_need: "a longer search" });
    if (!reports) return open;
    const own = findings.own();
    if (!own.some((row) => row.kind === "gap")) findings.record("gap", { node, missing: `research stopped: ${why}`, would_need: "a longer search" });
    if (!own.some((row) => row.kind === "node_status")) {
      findings.record("node_status", { node, status: "incomplete", done_criterion_met: false, why: `the ${limit}-turn limit was reached` });
    }
    return open;
  }
}
