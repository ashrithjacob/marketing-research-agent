import type { Usage } from "@earendil-works/pi-ai";

import type { Pricing } from "../adapters/index.js";
import { Clock, Scope, type ResearchStore, type StagePacket } from "../domain/index.js";

import type { LedgerPacket } from "./ledger-packet.js";
import type { LiveRuns } from "./live-runs.js";
import { Trace } from "../trace/index.js";

/** Decides what a finished run is: completed, invalid, failed or cancelled. */
export class RunSettlement {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly runId: string,
    private readonly packet: LedgerPacket,
  ) {}

  settle(output: string, usage: Usage & { pricing: Pricing }, errorMessage?: string, partProblems: readonly string[] = []): void {
    Trace.line(import.meta.url, "RunSettlement.settle", { output, usage, errorMessage, partProblems });
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

  /** Every agent has ended: the packet is built from the whole ledger, and only a failing ledger is invalid. */
  private settleFromLedger(usage: Usage & { pricing: Pricing }, partProblems: readonly string[], errorMessage?: string): void {
    Trace.line(import.meta.url, "RunSettlement.settleFromLedger", { errorMessage, partProblems });
    const assembled = this.packet.assemble();
    const problems = [...partProblems, ...("problems" in assembled ? assembled.problems : [])];
    const result = problems.length > 0 ? { problems } : assembled;
    if ("problems" in result) {
      if (errorMessage) {
        this.fail(errorMessage);
        return;
      }
      const error = result.problems.join("; ");
      this.store.addPacketCheck(this.runId, false, result.problems);
      this.store.updateRun(this.runId, { status: "invalid", error });
      this.runs.emit(this.runId, "packet.invalid", { error });
      return;
    }
    this.store.updateRun(this.runId, { packet: result.packet, packet_source: "ledger" });
    this.runs.emit(this.runId, "packet.ready", {
      sources: result.packet.sources.length,
      excerpts: result.packet.excerpts.length,
      gaps: result.packet.gaps.length,
      via: "ledger",
    });
    this.complete(result.packet, usage, errorMessage);
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
