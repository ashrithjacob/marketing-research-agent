import { Clock, Scope, type ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";
import type { Assembled, RunAssembly } from "./run-assembly.js";

export type RunEnding =
  | { kind: "settled"; errorMessage?: string }
  | { kind: "stopped"; reason?: string }
  | { kind: "crashed"; error: string }
  | { kind: "restarted" };

export type FinalStatus = "completed" | "invalid" | "failed" | "cancelled";

/** The only way a run reaches a final status: its ledger is assembled and the packet stored first, so whatever was found is shown however the run ended; the status then says how it ended. */
export class RunEnd {
  static readonly RESTARTED = "the server restarted while this run was in progress; the run did not survive it";

  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
  ) {}

  async end(assembly: RunAssembly, ending: RunEnding, record: { output?: string; usage?: unknown } = {}): Promise<FinalStatus> {
    Trace.line(import.meta.url, "RunEnd.end", { runId: assembly.runId, ending: ending.kind });
    const runId = assembly.runId;
    const run = await this.store.getRun(runId);
    const stopped: RunEnding | null = ending.kind === "settled" && run?.status === "stopping" ? { kind: "stopped", reason: ending.errorMessage } : null;
    await this.store.updateRun(runId, { ...record, ...(run?.ended_at ? {} : { ended_at: Clock.nowIso() }) });
    const { assembled, crash } = await RunEnd.assembleOrCrash(assembly);
    const actual = crash ?? stopped ?? ending;
    if (assembled.packet) await this.show(assembly, assembled);
    const { status, error } = RunEnd.verdict(actual, assembled);
    if (status === "invalid") {
      await this.store.addPacketCheck(runId, false, assembled.problems);
      this.runs.emit(runId, "packet.invalid", { error });
    }
    await this.store.updateRun(runId, { status, error });
    this.runs.emit(runId, `run.${status}`, status === "completed" ? { usage: record.usage } : error ? { error } : {});
    if (status === "completed") await this.countJudgementApplications(runId, assembled);
    if (status === "completed" && actual.kind === "settled" && actual.errorMessage) this.runs.emit(runId, "run.ended_early", { error: actual.errorMessage });
    return status;
  }

  /** A run refused before anything started: no ledger to assemble. */
  async refuse(runId: string, error: string): Promise<void> {
    Trace.line(import.meta.url, "RunEnd.refuse", { runId, error });
    await this.store.updateRun(runId, { status: "failed", error, ended_at: Clock.nowIso() });
    this.runs.emit(runId, "run.failed", { error });
  }

  private async show(assembly: RunAssembly, assembled: Assembled): Promise<void> {
    Trace.line(import.meta.url, "RunEnd.show", { runId: assembly.runId, retracted: assembled.retracted.length });
    const packet = assembled.packet!;
    await this.store.updateRun(assembly.runId, { packet: packet as unknown as Record<string, unknown>, packet_source: assembly.via });
    this.runs.emit(assembly.runId, "packet.ready", {
      sources: packet.sources?.length ?? 0,
      excerpts: "excerpts" in packet ? packet.excerpts.length : 0,
      gaps: packet.gaps.length,
      retracted: assembled.retracted.length,
      via: assembly.via,
    });
  }

  private static async assembleOrCrash(assembly: RunAssembly): Promise<{ assembled: Assembled; crash: RunEnding | null }> {
    Trace.line(import.meta.url, "RunEnd.assembleOrCrash", { runId: assembly.runId });
    try {
      return { assembled: await assembly.assemble(), crash: null };
    } catch (error) {
      console.error(`research run ${assembly.runId}: assembling the ledger failed`, error);
      const message = error instanceof Error ? error.message : String(error);
      return { assembled: { packet: null, problems: [], retracted: [] }, crash: { kind: "crashed", error: `settling failed: ${message}` } };
    }
  }

  private static verdict(ending: RunEnding, assembled: Assembled): { status: FinalStatus; error: string } {
    Trace.line(import.meta.url, "RunEnd.verdict", { ending: ending.kind, problems: assembled.problems.length });
    switch (ending.kind) {
      case "stopped":
        return { status: "cancelled", error: ending.reason || "stopped by the operator" };
      case "crashed":
        return { status: "failed", error: ending.error };
      case "restarted":
        return { status: "failed", error: RunEnd.RESTARTED };
      case "settled": {
        const broken = !assembled.packet || assembled.problems.length > 0;
        if (broken && ending.errorMessage) return { status: "failed", error: ending.errorMessage };
        if (broken) return { status: "invalid", error: assembled.problems.join("; ") };
        return { status: "completed", error: "" };
      }
    }
  }

  private async countJudgementApplications(runId: string, assembled: Assembled): Promise<void> {
    Trace.line(import.meta.url, "RunEnd.countJudgementApplications", { runId });
    const run = await this.store.getRun(runId);
    const sources = assembled.packet?.sources ?? [];
    if (!run) return;
    const byId = new Map((await this.store.listJudgements(Scope.of(run.workspace_id))).map((j) => [j.id, j]));
    for (const judgementId of run.judgement_ids) {
      const judgement = byId.get(judgementId);
      if (!judgement || judgement.rejects_kinds.length === 0) continue;
      const hits = sources.filter((s) => !s.admitted && judgement.rejects_kinds.includes(s.kind)).length;
      if (hits > 0) await this.store.bumpJudgement(judgementId, hits);
    }
  }
}
