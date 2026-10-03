import { Scope, type ResearchRun, type ResearchStore } from "../domain/index.js";
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

  async resettleAll(): Promise<string[]> {
    Trace.line(import.meta.url, "InvalidRunResettle.resettleAll");
    const stale: ResearchRun[] = [];
    for (const run of await this.store.listRuns(Scope.everything, 200)) {
      if (run.status === "invalid" && run.packet === null && run.stage === 1 && (await this.store.findings.list(run.id)).length > 0) stale.push(run);
    }
    const end = new RunEnd(this.store, this.runs);
    const done: string[] = [];
    for (const run of stale) {
      try {
        await end.end(StoredRunAssembly.of(this.store, this.runs, run), { kind: "settled" });
        done.push(run.id);
      } catch (error) {
        console.error(`re-settling run ${run.id} failed; it stays as it was`, error);
      }
    }
    return done;
  }
}
