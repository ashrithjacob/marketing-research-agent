import {
  Briefs,
  Roles,
  STAGE_ONE_AGENTS,
  StageOnePlans,
  briefSchema,
  type Brief,
  type CheckProblem,
  type Node,
  type ResearchRun,
  type ResearchStore,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { RoleChecks } from "./role-checks.js";
import type { LiveRuns } from "./live-runs.js";
import { ProductTruthRunAssembly } from "./product-truth-run-assembly.js";
import { RunFindings } from "./run-findings.js";
import { ReviewLedger } from "./review-ledger.js";
import { ReviewMiningRunAssembly } from "./review-mining-run-assembly.js";
import type { RunAssembly } from "./run-assembly.js";
import { StageOneRunAssembly } from "./stage-one-run-assembly.js";

/** The assembly for a run no live process holds — one a restart killed, or an old one settled again — rebuilt from what the store keeps of it. No model or paid tool is called. */
export class StoredRunAssembly {
  static of(store: ResearchStore, runs: LiveRuns, run: ResearchRun): RunAssembly {
    Trace.line(import.meta.url, "StoredRunAssembly.of", { runId: run.id, stage: run.stage });
    const brief = briefSchema.parse(run.brief);
    if (run.stage === 2) return new ProductTruthRunAssembly(store.findings, run.id, { sourceRunId: run.source_run_id, brief, markets: Briefs.markets(brief) });
    if (run.stage === 3) return new ReviewMiningRunAssembly(store, runs, run.id, brief, new ReviewLedger(), () => ({ targets: [], failures: [] }));
    const nodes = run.nodes as Node[];
    return new StageOneRunAssembly(store.findings, run.id, { brief, nodes }, () => StoredRunAssembly.partProblems(store, run.id, brief, nodes));
  }

  /** Each stage-1 agent that wrote rows, checked again on the ledger it left. */
  private static partProblems(store: ResearchStore, runId: string, brief: Brief, nodes: readonly Node[]): CheckProblem[] {
    Trace.line(import.meta.url, "StoredRunAssembly.partProblems", { runId });
    const wrote = new Set(store.findings.list(runId).map((row) => row.agent_id));
    return STAGE_ONE_AGENTS.filter((id) => wrote.has(id)).flatMap((id) =>
      RoleChecks.done(Roles.of(id), new RunFindings(store.findings, runId, id, [StageOnePlans.nodeOf(id, nodes)]), { brief, nodes, markets: Briefs.markets(brief) })
        .problems()
        .map((problem) => ({ ...problem, text: `${id}: ${problem.text}` })),
    );
  }
}
