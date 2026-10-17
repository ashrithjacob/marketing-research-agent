import { Scope, type ResearchRun, type ResearchStore, type RunRequest, type StagePacket } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { CustomerTruthInputs, type CustomerEvidence } from "./customer-truth-inputs.js";
import { RunError } from "./errors.js";
import type { LiveRuns } from "./live-runs.js";
import { MarketTruthInputs, type MarketEvidence } from "./market-truth-inputs.js";
import { OwnerCosts } from "./owner-costs.js";
import { RunEnd } from "./run-end.js";
import type { StageOneHandoff } from "./stage-one-handoff.js";

/** What a later stage reads from the earlier ones, loaded for one run and recorded on it as its source; a run missing what it needs is refused before any agent starts. */
export class RunInputs {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly handoff: StageOneHandoff,
  ) {}

  /** The completed stage-1 run product truth reads, recorded on the run so a newer stage 1 shows this one as out of date. */
  async productTruth(run: ResearchRun, request: RunRequest, workspaceId: string): Promise<{ sourceRunId: string; stageOne: StagePacket }> {
    Trace.line(import.meta.url, "RunInputs.productTruth", { runId: run.id });
    const found = await this.handoff.forBrief(request.brief, Scope.of(workspaceId));
    if (!found) return this.refuse(run, "product truth reads a completed stage-1 run, and this brief has none");
    await this.store.updateRun(run.id, { source_run_id: found.run.id });
    return { sourceRunId: found.run.id, stageOne: found.packet };
  }

  /** The earlier stages market truth reads, with the owner's saved landed cost where product truth ran without one. */
  async marketTruth(run: ResearchRun, request: RunRequest, workspaceId: string): Promise<MarketEvidence> {
    Trace.line(import.meta.url, "RunInputs.marketTruth", { runId: run.id });
    const found = await new MarketTruthInputs(this.store, this.handoff).load(request.brief, Scope.of(workspaceId));
    if ("error" in found) return this.refuse(run, found.error);
    await this.store.updateRun(run.id, { source_run_id: found.sourceRunId });
    return { ...found, truth: await new OwnerCosts(this.store).intoTruth(found.truth, workspaceId, run.product_id) };
  }

  /** Product truth, market truth and the mined reviews customer truth reads, recorded on the run by its market-truth run. */
  async customerTruth(run: ResearchRun, request: RunRequest, workspaceId: string): Promise<CustomerEvidence> {
    Trace.line(import.meta.url, "RunInputs.customerTruth", { runId: run.id });
    const found = await new CustomerTruthInputs(this.store).load(request.brief, Scope.of(workspaceId));
    if ("error" in found) return this.refuse(run, found.error);
    await this.store.updateRun(run.id, { source_run_id: found.sourceRunId });
    return found;
  }

  private async refuse(run: ResearchRun, error: string): Promise<never> {
    Trace.line(import.meta.url, "RunInputs.refuse", { runId: run.id, error });
    await new RunEnd(this.store, this.runs).refuse(run.id, error);
    throw new RunError(error);
  }
}
