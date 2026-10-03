import { OPERATOR_AGENT, STAGE_NODES, type FindingLedger, type ProductTruthInputs } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { RunFindings } from "./run-findings.js";

/** What the operator typed when starting product truth, written to the ledger before any agent starts: the costs, a gap for each left blank, and any prices added. */
export class OperatorInputs {
  static readonly SOURCE = "operator";

  constructor(private readonly ledger: FindingLedger, private readonly runId: string) {}

  async record(inputs: ProductTruthInputs): Promise<void> {
    Trace.line(import.meta.url, "OperatorInputs.record", { inputs });
    const hand = new RunFindings(this.ledger, this.runId, OPERATOR_AGENT, STAGE_NODES[2]);
    const { prices, ...costs } = inputs;
    await hand.record("operator_input", { ...costs, currency: costs.currency.trim().toUpperCase() });
    const blank: Array<[keyof typeof costs, string]> = [
      ["landed_unit_cost", "landed_unit_cost: not entered when product truth started, so no margin is computed"],
      ["moq", "moq: not entered when product truth started"],
      ["lead_time_days", "lead_time_days: not entered when product truth started"],
    ];
    for (const [field, missing] of blank) {
      if (costs[field] === null) await hand.record("gap", { node: "cogs_refills", missing, would_need: "the operator's figure from the supplier" });
    }
    for (const price of prices) await hand.record("price_point", { ...price, market: "", source_id: OperatorInputs.SOURCE });
  }
}
