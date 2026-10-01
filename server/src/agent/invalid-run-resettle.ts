import type { Usage } from "@earendil-works/pi-ai";

import type { Pricing } from "../adapters/index.js";
import {
  STAGE_ONE_AGENTS,
  StageOnePlans,
  Scope,
  briefSchema,
  type CheckProblem,
  type Node,
  type ResearchRun,
  type ResearchStore,
  type StageOneAgent,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { DoneChecks } from "./done-check.js";
import { LedgerPacket } from "./ledger-packet.js";
import type { LiveRuns } from "./live-runs.js";
import { RowRepair } from "./row-repair.js";
import { RunFindings } from "./run-findings.js";
import { RunSettlement } from "./run-settlement.js";

/** Stage-1 runs that ended invalid with no packet but rows in their ledger, from before settlement repaired rows, settled again from their ledgers so what they found is shown. No model or paid tool is called. */
export class InvalidRunResettle {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
  ) {}

  resettleAll(): string[] {
    Trace.line(import.meta.url, "InvalidRunResettle.resettleAll");
    const stale = this.store.listRuns(Scope.everything, 200).filter(
      (run) => run.status === "invalid" && run.packet === null && run.stage === 1 && this.store.findings.list(run.id).length > 0,
    );
    const done: string[] = [];
    for (const run of stale) {
      try {
        this.resettle(run);
        done.push(run.id);
      } catch (error) {
        console.error(`re-settling run ${run.id} failed; it stays as it was`, error);
      }
    }
    return done;
  }

  private resettle(run: ResearchRun): void {
    Trace.line(import.meta.url, "InvalidRunResettle.resettle", { runId: run.id });
    const brief = briefSchema.parse(run.brief);
    const nodes = run.nodes as Node[];
    const ledger = this.store.findings;
    const agents = new Set(ledger.list(run.id).map((row) => row.agent_id));
    const parts = STAGE_ONE_AGENTS.filter((id) => agents.has(id));
    const partProblems = (): CheckProblem[] =>
      parts.flatMap((id: StageOneAgent) =>
        DoneChecks.of(id, new RunFindings(ledger, run.id, id, [StageOnePlans.nodeOf(id, nodes)]), brief, nodes)
          .problems()
          .map((problem) => ({ ...problem, text: `${id}: ${problem.text}` })),
      );
    const settlement = new RunSettlement(this.store, this.runs, run.id, new LedgerPacket(ledger, run.id, { brief, nodes }), new RowRepair(ledger, run.id, nodes));
    settlement.resettle(run.usage as unknown as Usage & { pricing: Pricing }, partProblems);
  }
}
