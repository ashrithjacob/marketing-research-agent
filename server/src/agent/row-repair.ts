import { FINDING_NODES, Findings, StageOnePlans, type CheckProblem, type Finding, type FindingLedger, type Node, type StageOneAgent } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { RunFindings } from "./run-findings.js";

/** Takes out of the packet every row a check problem is about, recording a gap that names it, so one bad row costs that row and not the run. */
export class RowRepair {
  constructor(
    private readonly ledger: FindingLedger,
    private readonly runId: string,
    private readonly nodes: readonly Node[],
  ) {}

  /** Retracting one row can break another that leaned on it (a `complete` status on a retracted curve), so this repeats until no row of `owner` (every agent's when unset) fails. */
  repair(problems: () => readonly CheckProblem[], when: string, owner?: string): string[] {
    Trace.line(import.meta.url, "RowRepair.repair", { when, owner });
    const retracted: string[] = [];
    let failing = this.failingRows(problems(), owner);
    while (failing.size > 0) {
      for (const [row, texts] of failing) {
        const hand = new RunFindings(this.ledger, this.runId, row.agent_id, this.nodes);
        hand.retract(row.id, `failed its check ${when}`);
        hand.record("gap", {
          node: this.nodeOf(row),
          missing: `${row.kind} ${row.id} retracted ${when}: ${texts.join("; ")}`,
          would_need: "the agent to repair it",
        });
        if (row.kind === "node_status") {
          hand.record("node_status", { node: this.nodeOf(row), status: "incomplete", done_criterion_met: false, why: `its status was retracted ${when}` });
        }
        retracted.push(row.id);
      }
      failing = this.failingRows(problems(), owner);
    }
    return retracted;
  }

  private failingRows(problems: readonly CheckProblem[], owner?: string): Map<Finding, string[]> {
    Trace.line(import.meta.url, "RowRepair.failingRows", { problems: problems.length, owner });
    const live = Findings.live(this.ledger.list(this.runId)).filter((row) => owner === undefined || row.agent_id === owner);
    const failing = new Map<Finding, string[]>();
    for (const problem of problems) {
      const at = problem.row;
      if (!at) continue;
      const row = live.find((r) => r.kind === at.kind && Findings.identity(r.kind, r.payload, r.id) === at.key);
      if (row) failing.set(row, [...(failing.get(row) ?? []), problem.text]);
    }
    return failing;
  }

  private nodeOf(row: Finding): Node {
    Trace.line(import.meta.url, "RowRepair.nodeOf", { kind: row.kind });
    const node = row.payload.node;
    if (typeof node === "string" && this.nodes.includes(node as Node)) return node as Node;
    const filed = FINDING_NODES[row.kind];
    if (filed && this.nodes.includes(filed)) return filed;
    return StageOnePlans.nodeOf(row.agent_id as StageOneAgent, this.nodes);
  }
}
