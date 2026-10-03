import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** Holds a run's row until the transaction ends, so two writers numbering the run's rows take turns instead of both reading the same highest number. */
export class RunLock {
  static async claim(tx: SqlDatabase, runId: string): Promise<void> {
    Trace.line(import.meta.url, "RunLock.claim", { runId });
    await tx.run("UPDATE research_runs SET updated_at = updated_at WHERE id = ?", [runId]);
  }
}
