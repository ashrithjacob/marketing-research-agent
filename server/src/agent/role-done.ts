import type { CheckProblem } from "../domain/index.js";
import type { DeliverableCheck } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { DoneCheck } from "./done-check.js";
import type { RunFindings } from "./run-findings.js";

/** A role is done when its deliverable lacks nothing and its rows pass the consistency checks for its part. */
export class RoleDone implements DoneCheck {
  constructor(
    private readonly findings: RunFindings,
    private readonly deliverable: DeliverableCheck,
    private readonly consistency: DoneCheck,
  ) {}

  async problems(): Promise<CheckProblem[]> {
    Trace.line(import.meta.url, "RoleDone.problems", { agentId: this.findings.agentId });
    const open = this.deliverable.missing(await this.findings.live()).map((missing) => ({ text: missing.text, row: missing.row ?? null }));
    return [...open, ...(await this.consistency.problems())];
  }
}
