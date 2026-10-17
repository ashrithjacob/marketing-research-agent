import type { CheckProblem } from "../domain/index.js";
import { CustomerTruthCheck } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { DoneCheck } from "./done-check.js";
import type { RunFindings } from "./run-findings.js";

/** A customer-truth agent's part passes its node's contract, and the avatars and awareness agents' parts hold across rows. */
export class CustomerContract implements DoneCheck {
  constructor(
    private readonly findings: RunFindings,
    private readonly node: DoneCheck,
  ) {}

  async problems(): Promise<CheckProblem[]> {
    Trace.line(import.meta.url, "CustomerContract.problems", { agentId: this.findings.agentId });
    const rows = await this.findings.live();
    const across = this.findings.agentId === "avatars" ? CustomerTruthCheck.avatars(rows) : this.findings.agentId === "awareness" ? CustomerTruthCheck.awareness(rows) : [];
    return [...(await this.node.problems()), ...across];
  }
}
