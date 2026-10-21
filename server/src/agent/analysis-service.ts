import {
  FINAL_RUN_STATUSES,
  AnalysisInputSchema,
  ConfirmationSchema,
  RerunRequestSchema,
  Schemas,
  Stages,
  type Confirmation,
  type ResearchStore,
  type Run,
  type Scope,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";
import type { Pipeline } from "./pipeline/pipeline.js";
import type { RunLauncher } from "./run-launcher.js";

export type Refused = { refused: string[] };

/** What the http layer asks of runs: start one from what the user typed, confirm what it resolved, stop it, and end what a restart cut off. */
export class AnalysisService {
  constructor(
    private readonly store: ResearchStore,
    private readonly launcher: RunLauncher,
    private readonly live: LiveRuns,
    private readonly pipeline: Pipeline,
    private readonly model: string,
  ) {}

  async start(accountId: string, raw: unknown): Promise<Run | Refused> {
    Trace.line(import.meta.url, "AnalysisService.start", { accountId });
    const parsed = Schemas.parse(AnalysisInputSchema, raw);
    if (!parsed.ok) return { refused: parsed.problems };
    this.launcher.chain();
    const run = await this.store.runs.create({ accountId, input: parsed.value, model: this.model, stages: Stages.initial(this.pipeline.built) });
    this.launcher.resolve(run);
    return run;
  }

  async confirm(run: Run, raw: unknown): Promise<Run | Refused> {
    Trace.line(import.meta.url, "AnalysisService.confirm", { runId: run.id });
    if (run.status !== "awaiting_confirmation") return { refused: [`the run is ${run.status}, not awaiting confirmation`] };
    const parsed = Schemas.parse(ConfirmationSchema, raw);
    if (!parsed.ok) return { refused: parsed.problems };
    const resolved = run.resolution?.product.url === parsed.value.product_url ? run.resolution.product.brand : "";
    const product = await this.store.products.upsert(run.account_id, parsed.value.product_url, AnalysisService.productName(run, parsed.value), resolved);
    const competitors = await this.store.competitors.confirm(product, parsed.value.competitors);
    await this.store.runs.updateRun(run.id, { product_id: product.id, status: "running" });
    const started = (await this.store.runs.get(run.id))!;
    this.launcher.research(started, product, competitors);
    return started;
  }

  /** Runs again every built stage of a finished run that did not complete, keeping what did; refused while the run is still working or before it has a product. */
  async rerun(run: Run, raw: unknown): Promise<Run | Refused> {
    Trace.line(import.meta.url, "AnalysisService.rerun", { runId: run.id, status: run.status });
    if (!FINAL_RUN_STATUSES.has(run.status)) return { refused: [`the run is ${run.status}; only a finished run can rerun stages`] };
    if (!run.product_id) return { refused: ["the run never got past confirmation, so it has no stages to rerun"] };
    const parsed = Schemas.parse(RerunRequestSchema, raw ?? {});
    if (!parsed.ok) return { refused: parsed.problems };
    const built = this.pipeline.built;
    const unbuilt = parsed.value.stages.filter((name) => !built.includes(name));
    if (unbuilt.length > 0) return { refused: [`${unbuilt.join(", ")} is not built yet, so it cannot run`] };
    const stages = Stages.toRerun(run.stage_status, built, parsed.value.stages);
    if (stages.length === 0) return { refused: ["every stage of this run completed; choose the stages to rerun"] };
    const product = (await this.store.products.get(run.product_id))!;
    const competitors = (await this.store.competitors.list(product.id)).filter((competitor) => competitor.status === "confirmed");
    await this.store.runs.updateRun(run.id, { status: "running", error: "", ended_at: null, stage_status: Stages.rerun(run.stage_status, built, stages) });
    const restarted = (await this.store.runs.get(run.id))!;
    await this.store.events.add(run.id, "run.rerun", { stages });
    this.launcher.research(restarted, product, competitors);
    return restarted;
  }

  async stop(run: Run): Promise<void> {
    Trace.line(import.meta.url, "AnalysisService.stop", { runId: run.id, status: run.status });
    if (run.status === "awaiting_confirmation") return this.launcher.runEnd.end(run.id, { status: "cancelled", error: "" });
    if (!this.live.has(run.id)) return;
    await this.store.runs.updateRun(run.id, { status: "stopping" });
    this.live.stop(run.id);
  }

  /** Deletes the run and everything it produced; refused while it is working, since a live run would keep writing to it. */
  async delete(run: Run): Promise<Refused | null> {
    Trace.line(import.meta.url, "AnalysisService.delete", { runId: run.id, status: run.status });
    if (!FINAL_RUN_STATUSES.has(run.status) && run.status !== "awaiting_confirmation") return { refused: [`the run is ${run.status}; stop it before deleting it`] };
    await this.store.runs.delete(run.id);
    return null;
  }

  async get(runId: string, scope: Scope): Promise<Run | null> {
    Trace.line(import.meta.url, "AnalysisService.get", { runId });
    const run = await this.store.runs.get(runId);
    return run && scope.admits(run.account_id) ? run : null;
  }

  async recover(): Promise<number> {
    Trace.line(import.meta.url, "AnalysisService.recover");
    const cut = await this.store.runs.unfinished();
    for (const run of cut) await this.launcher.runEnd.end(run.id, { status: "failed", error: "the server restarted while this run was working" });
    return cut.length;
  }

  private static productName(run: Run, confirmation: Confirmation): string {
    Trace.line(import.meta.url, "AnalysisService.productName", { runId: run.id });
    const resolved = run.resolution?.product;
    if (resolved && resolved.url === confirmation.product_url) return resolved.name;
    const alternative = run.resolution?.alternatives.find((candidate) => candidate.url === confirmation.product_url);
    return alternative?.name ?? run.input.product_name ?? confirmation.product_url;
  }
}
