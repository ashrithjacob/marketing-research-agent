import type { Node, ProductTruthAgent } from "../domain/index.js";
import { ProductTruthCoverage } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { DoneCheck } from "./done-check.js";
import type { LimitClosed } from "./limit-close.js";
import type { RowRepair } from "./row-repair.js";
import type { RunFindings } from "./run-findings.js";

/** Closes a product-truth agent its turn limit ended: rows that cite nothing it read are retracted with a gap each, and every item still open is gapped. */
export class TruthLimitClose {
  constructor(
    private readonly findings: RunFindings,
    private readonly repair: RowRepair,
    private readonly check: DoneCheck,
    private readonly part: { agent: ProductTruthAgent; node: Node; markets: readonly string[] },
    private readonly limit: number,
  ) {}

  close(): LimitClosed {
    Trace.line(import.meta.url, "TruthLimitClose.close", { agent: this.part.agent, limit: this.limit });
    const retracted = this.repair.repair(() => this.check.problems(), `at the ${this.limit}-turn limit`, this.findings.agentId);
    const open = new ProductTruthCoverage(this.findings.live(), this.part.markets).open(this.part.agent);
    for (const item of open) {
      this.findings.record("gap", { node: this.part.node, missing: `${item.key}: not found within the ${this.limit}-turn limit`, would_need: "a longer search" });
    }
    return { gapped: open.map((item) => item.key), retracted };
  }
}
