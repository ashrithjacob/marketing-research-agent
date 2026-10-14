import { Briefs, briefSchema, taskContractSchema, type Node, type ResearchRun, type ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";
import { ProductTruthRunAssembly } from "./product-truth-run-assembly.js";
import { ReviewLedger } from "./review-ledger.js";
import { ReviewMiningRunAssembly } from "./review-mining-run-assembly.js";
import type { RunAssembly } from "./run-assembly.js";
import { StageOneParts } from "./stage-one-parts.js";
import { StageOneRunAssembly } from "./stage-one-run-assembly.js";
import { TaskWorks } from "./task/task-work.js";

/** The assembly for a run no live process holds — one a restart killed, or an old one settled again — rebuilt from what the store keeps of it. No model or paid tool is called. */
export class StoredRunAssembly {
  static of(store: ResearchStore, runs: LiveRuns, run: ResearchRun): RunAssembly {
    Trace.line(import.meta.url, "StoredRunAssembly.of", { runId: run.id, stage: run.stage });
    const brief = briefSchema.parse(run.brief);
    if (run.stage === 2) return new ProductTruthRunAssembly(store.findings, run.id, { sourceRunId: run.source_run_id, brief, markets: Briefs.markets(brief) });
    if (run.stage === 3) return new ReviewMiningRunAssembly(store, runs, run.id, brief, new ReviewLedger(), () => ({ targets: [], failures: [] }));
    const nodes = run.nodes as Node[];
    if (run.contract) {
      const contract = taskContractSchema.parse(run.contract);
      return TaskWorks.assembly(store, run, contract, brief);
    }
    return new StageOneRunAssembly(store.findings, run.id, { brief, nodes, roles: StageOneParts.planned(brief, nodes) });
  }
}
