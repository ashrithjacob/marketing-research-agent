import type { RunBilling } from "../adapters/index.js";
import { stagePacketSchema, type Node, type ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";
import { RunMeter } from "./run-meter.js";
import type { StageOneListings } from "./stage-one-listings.js";

/** What follows a settled stage-1 run: the Amazon listings of what it found, and its billed cost. */
export class RunWrapUp {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly runId: string,
    private readonly listings?: StageOneListings,
  ) {}

  /** After a completed competitors run, never before: an Apify search can wait minutes, and must not hold the run's status. A failure here is an event; it never changes the status. */
  async lookUpListings(nodes: readonly Node[]): Promise<void> {
    Trace.line(import.meta.url, "RunWrapUp.lookUpListings", { nodes });
    const { store, runs, runId, listings } = this;
    try {
      if (!listings?.available || !nodes.includes("competitors")) return;
      const run = await store.getRun(runId);
      const packet = stagePacketSchema.safeParse(run?.packet);
      if (run?.status !== "completed" || !packet.success) return;
      const rows = await listings.lookUp(runId, packet.data, new RunMeter(store, runs, runId, null));
      runs.emit(runId, "packet.listings", { total: rows.length, matched: rows.filter((row) => row.matches).length });
    } catch (error) {
      runs.emit(runId, "packet.listings", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  async recordBilling(billing: RunBilling): Promise<void> {
    Trace.line(import.meta.url, "RunWrapUp.recordBilling", { billing });
    const { store, runs, runId } = this;
    try {
      const billed = await billing.settle();
      if (!billed) return;
      const usage = (await store.getRun(runId))?.usage ?? {};
      await store.updateRun(runId, { usage: { ...usage, billed } });
      runs.emit(runId, "run.billed", { billed });
    } catch (error) {
      console.error(`research run ${runId}: recording the billed cost failed`, error);
    }
  }
}
