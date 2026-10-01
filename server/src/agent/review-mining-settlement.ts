import { Clock, type Brief, type MiningTarget, type ResearchStore } from "../domain/index.js";
import { PacketError, PacketValidator, ReviewMiningPacket, type PullFailure } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";
import type { ReviewLedger } from "./review-ledger.js";

/** Ends a review-mining run: its reviews saved however it ends, then completed, invalid, cancelled or failed. */
export class ReviewMiningSettlement {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly runId: string,
    private readonly ledger: ReviewLedger,
  ) {}

  settle(brief: Brief, targets: readonly MiningTarget[], failures: readonly PullFailure[], stopped: boolean): void {
    Trace.line(import.meta.url, "ReviewMiningSettlement.settle", { targets: targets.length, failures: failures.length, stopped });
    this.ledger.saveTo(this.store, this.runs, this.runId);
    if (stopped) {
      this.end("cancelled", "stopped by the operator");
      return;
    }
    const snapshot = this.ledger.snapshot();
    const draft = new ReviewMiningPacket(targets, snapshot, failures).draft(this.runId, brief);
    try {
      const packet = new PacketValidator(snapshot).validate(draft, ["review_mining"], brief);
      this.store.updateRun(this.runId, { packet, packet_source: "pipeline" });
      this.runs.emit(this.runId, "packet.ready", {
        sources: packet.sources.length,
        excerpts: packet.excerpts.length,
        gaps: packet.gaps.length,
        via: "pipeline",
      });
      this.end("completed", "");
    } catch (error) {
      if (!(error instanceof PacketError)) throw error;
      this.store.addPacketCheck(this.runId, false, error.problems);
      this.runs.emit(this.runId, "packet.invalid", { error: error.message });
      this.end("invalid", error.message);
    }
  }

  fail(error: unknown, stopped: boolean): void {
    Trace.line(import.meta.url, "ReviewMiningSettlement.fail", { stopped });
    this.ledger.saveTo(this.store, this.runs, this.runId);
    this.end(stopped ? "cancelled" : "failed", error instanceof Error ? error.message : String(error));
  }

  private end(status: "completed" | "invalid" | "cancelled" | "failed", error: string): void {
    Trace.line(import.meta.url, "ReviewMiningSettlement.end", { status });
    this.store.updateRun(this.runId, { status, error, ended_at: Clock.nowIso() });
    this.runs.emit(this.runId, `run.${status}`, error ? { error } : {});
    this.runs.closeSubscribers(this.runId);
    this.runs.remove(this.runId);
  }
}
