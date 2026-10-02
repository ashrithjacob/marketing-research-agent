import { Scope, type ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";
import { RunEnd } from "./run-end.js";
import { StoredRunAssembly } from "./stored-run-assembly.js";

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
    const end = new RunEnd(this.store, this.runs);
    const done: string[] = [];
    for (const run of stale) {
      try {
        end.end(StoredRunAssembly.of(this.store, this.runs, run), { kind: "settled" });
        done.push(run.id);
      } catch (error) {
        console.error(`re-settling run ${run.id} failed; it stays as it was`, error);
      }
    }
    return done;
  }
}
