import type { AgentTurnDecision } from "@earendil-works/pi-agent-core";

import { NodeFields, type Node } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { RunFindings } from "./run-findings.js";

/** How many model turns one agent may take; pi-agent-core's finishTurn hook ends it on the last, and what is still open becomes gaps. */
export class TurnBudget {
  private used = 0;

  constructor(readonly limit: number) {}

  readonly finishTurn = (): AgentTurnDecision | undefined => {
    Trace.line(import.meta.url, "TurnBudget.finishTurn", { used: this.used, limit: this.limit });
    this.used += 1;
    return this.used >= this.limit ? { action: "end" } : undefined;
  };

  get spent(): boolean {
    Trace.line(import.meta.url, "TurnBudget.spent", { used: this.used, limit: this.limit });
    return this.used >= this.limit;
  }

  /** Records, under the agent's own id, a gap for every field still open and an incomplete status if it wrote none; returns the fields it gapped. */
  close(findings: RunFindings, node: Node): string[] {
    Trace.line(import.meta.url, "TurnBudget.close", { node, limit: this.limit });
    const why = `not found within the ${this.limit}-call limit`;
    const open = NodeFields.missing(node, findings.own());
    for (const field of open) findings.record("gap", { node, missing: `${field}: ${why}`, would_need: "a longer search" });
    const own = findings.own();
    if (!own.some((row) => row.kind === "gap")) findings.record("gap", { node, missing: `research stopped: ${why}`, would_need: "a longer search" });
    if (!own.some((row) => row.kind === "node_status")) {
      findings.record("node_status", { node, status: "incomplete", done_criterion_met: false, why: `the ${this.limit}-call limit was reached` });
    }
    return open;
  }
}
