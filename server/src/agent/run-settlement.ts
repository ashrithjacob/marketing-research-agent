import type { Usage } from "@earendil-works/pi-ai";

import type { Pricing } from "../adapters/index.js";
import { Clock, type Node, type ResearchStore, type StagePacket } from "../domain/index.js";
import { PacketError, PacketValidator } from "../extract/index.js";

import type { LiveRuns } from "./live-runs.js";

/** Decides what a finished run is: completed, invalid, failed or cancelled. */
export class RunSettlement {
  private validated: StagePacket | null = null;

  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly runId: string,
  ) {}

  keepValidated(packet: StagePacket): void {
    if (this.validated) return;
    this.validated = packet;
    this.store.updateRun(this.runId, { packet, packet_source: "tool", error: "" });
    this.runs.emit(this.runId, "packet.ready", {
      sources: packet.sources.length,
      excerpts: packet.excerpts.length,
      gaps: packet.gaps.length,
      via: "tool",
    });
  }

  hasValidated(): boolean {
    return this.validated !== null;
  }

  settle(
    output: string,
    usage: Usage & { pricing: Pricing },
    nodes: readonly Node[],
    errorMessage?: string,
  ): void {
    const run = this.store.getRun(this.runId);
    const stopping = run?.status === "stopping";

    this.store.updateRun(this.runId, { output, usage, ended_at: Clock.nowIso() });

    if (this.validated && !stopping) {
      this.store.updateRun(this.runId, { status: "completed", error: "" });
      this.countJudgementApplications(this.validated);
      this.runs.emit(this.runId, "run.completed", { usage });
      if (errorMessage) this.runs.emit(this.runId, "run.ended_early", { error: errorMessage });
      return;
    }

    if (errorMessage) {
      const status = stopping ? "cancelled" : "failed";
      this.store.updateRun(this.runId, { status, error: errorMessage });
      this.runs.emit(this.runId, `run.${status}`, { error: errorMessage });
      return;
    }
    if (stopping) {
      this.store.updateRun(this.runId, { status: "cancelled", error: "stopped by the operator" });
      this.runs.emit(this.runId, "run.cancelled", {});
      return;
    }

    let parsed: StagePacket;
    try {
      parsed = new PacketValidator().parse(output, nodes, run?.brief);
    } catch (error) {
      if (!(error instanceof PacketError)) throw error;
      this.store.updateRun(this.runId, { status: "invalid", error: error.message });
      this.runs.emit(this.runId, "packet.invalid", { error: error.message });
      return;
    }
    this.store.updateRun(this.runId, {
      status: "completed",
      packet: parsed,
      error: "",
      packet_source: "output",
    });
    this.countJudgementApplications(parsed);
    this.runs.emit(this.runId, "run.completed", { usage });
    this.runs.emit(this.runId, "packet.ready", {
      sources: parsed.sources.length,
      excerpts: parsed.excerpts.length,
      gaps: parsed.gaps.length,
    });
  }

  private countJudgementApplications(parsed: StagePacket): void {
    const run = this.store.getRun(this.runId);
    if (!run) return;
    const byId = new Map(this.store.listJudgements().map((j) => [j.id, j]));
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
