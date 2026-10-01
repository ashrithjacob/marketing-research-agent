import { CheckProblems, type CheckProblem, type ProductTruthAgent } from "../domain/index.js";
import { ProductTruthCoverage, TruthCitations } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { DoneCheck } from "./done-check.js";
import type { RunFindings } from "./run-findings.js";

/** A product-truth agent is done when every item its part owns is recorded or gapped, and every row it wrote cites a source in the ledger. */
export class ProductTruthDone implements DoneCheck {
  constructor(
    private readonly findings: RunFindings,
    private readonly agent: ProductTruthAgent,
    private readonly markets: readonly string[],
  ) {}

  problems(): CheckProblem[] {
    Trace.line(import.meta.url, "ProductTruthDone.problems", { agent: this.agent });
    const live = this.findings.live();
    const open = new ProductTruthCoverage(live, this.markets).open(this.agent).map((item) => CheckProblems.of(item.text));
    return [...open, ...TruthCitations.problems(this.findings.own(), live)];
  }
}
