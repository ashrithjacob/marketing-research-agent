import type { Usage } from "@earendil-works/pi-ai";

import type { Pricing } from "../adapters/index.js";
import { CheckProblems, Clock, Scope, type CheckProblem, type ResearchStore, type StagePacket } from "../domain/index.js";

import type { LedgerPacket } from "./ledger-packet.js";
import type { LiveRuns } from "./live-runs.js";
import type { RowRepair } from "./row-repair.js";
import { Trace } from "../trace/index.js";

/** Decides what a finished run is: completed, invalid, failed or cancelled; a run with rows in its ledger always keeps the packet they make. */
export class RunSettlement {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly runId: string,
    private readonly packet: LedgerPacket,
    private readonly repair: RowRepair,
  ) {}

  settle(
    output: string,
    usage: Usage & { pricing: Pricing },
    errorMessage?: string,
    partProblems: () => readonly CheckProblem[] = () => [],
  ): void {
    Trace.line(import.meta.url, "RunSettlement.settle", { output, usage, errorMessage });
    const stopping = this.store.getRun(this.runId)?.status === "stopping";
    this.store.updateRun(this.runId, { output, usage, ended_at: Clock.nowIso() });

    if (stopping) {
      this.store.updateRun(this.runId, { status: "cancelled", error: errorMessage || "stopped by the operator" });
      this.runs.emit(this.runId, "run.cancelled", errorMessage ? { error: errorMessage } : {});
      return;
    }
    if (errorMessage && this.packet.isEmpty()) {
      this.fail(errorMessage);
      return;
    }
    this.settleFromLedger(usage, partProblems, errorMessage);
  }

  /** Settles again a run that ended before rows could be repaired, from the ledger it left; its output, usage and end time stay as they were. */
  resettle(usage: Usage & { pricing: Pricing }, partProblems: () => readonly CheckProblem[]): void {
    Trace.line(import.meta.url, "RunSettlement.resettle", { runId: this.runId });
    this.settleFromLedger(usage, partProblems);
  }

  /** Every agent has ended: rows that break the contract are retracted into gaps, and whatever parses is kept and shown, even when a problem no single row owns leaves the run invalid. */
  private settleFromLedger(usage: Usage & { pricing: Pricing }, partProblems: () => readonly CheckProblem[], errorMessage?: string): void {
    Trace.line(import.meta.url, "RunSettlement.settleFromLedger", { errorMessage });
    const all = () => [...partProblems(), ...this.packet.assemble().problems];
    const retracted = this.repair.repair(all, "when the run settled");
    const { packet } = this.packet.assemble();
    const problems = CheckProblems.texts(all());
    if (packet) {
      this.store.updateRun(this.runId, { packet, packet_source: "ledger" });
      this.runs.emit(this.runId, "packet.ready", {
        sources: packet.sources.length,
        excerpts: packet.excerpts.length,
        gaps: packet.gaps.length,
        retracted: retracted.length,
        via: "ledger",
      });
    }
    if (problems.length > 0 || !packet) {
      if (errorMessage) {
        this.fail(errorMessage);
        return;
      }
      const error = problems.join("; ");
      this.store.addPacketCheck(this.runId, false, problems);
      this.store.updateRun(this.runId, { status: "invalid", error });
      this.runs.emit(this.runId, "packet.invalid", { error });
      return;
    }
    this.complete(packet, usage, errorMessage);
  }

  private complete(packet: StagePacket, usage: Usage & { pricing: Pricing }, errorMessage?: string): void {
    Trace.line(import.meta.url, "RunSettlement.complete", { errorMessage });
    this.store.updateRun(this.runId, { status: "completed", error: "" });
    this.countJudgementApplications(packet);
    this.runs.emit(this.runId, "run.completed", { usage });
    if (errorMessage) this.runs.emit(this.runId, "run.ended_early", { error: errorMessage });
  }

  private fail(errorMessage: string): void {
    Trace.line(import.meta.url, "RunSettlement.fail", { errorMessage });
    this.store.updateRun(this.runId, { status: "failed", error: errorMessage });
    this.runs.emit(this.runId, "run.failed", { error: errorMessage });
  }

  private countJudgementApplications(parsed: StagePacket): void {
    Trace.line(import.meta.url, "RunSettlement.countJudgementApplications", { parsed });
    const run = this.store.getRun(this.runId);
    if (!run) return;
    const byId = new Map(this.store.listJudgements(Scope.of(run.workspace_id)).map((j) => [j.id, j]));
    for (const judgementId of run.judgement_ids) {
      const judgement = byId.get(judgementId);
      if (!judgement || judgement.rejects_kinds.length === 0) continue;
      const hits = parsed.sources.filter(
        (s) => !s.admitted && judgement.rejects_kinds.includes(s.kind),
      ).length;
      if (hits > 0) this.store.bumpJudgement(judgementId, hits);
    }
  }
}
