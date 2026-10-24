import { STAGE3_STEPS, type AdAngle, type Product, type ReadAd } from "../../../domain/index.js";
import { AdsAnalyzer } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import type { StageOutcome } from "../../pipeline/stage.js";

import { AngleFitter } from "./angle-fitter.js";
import { AngleGrouper } from "./angle-grouper.js";
import { FindingsWriter } from "./findings-writer.js";

/** Stage 3's analysis once its ads are read: group them into angles, judge each angle's fit with the client, then write the findings for steps 2 to 5 over what code counted. */
export class AdAnalysisStep {
  constructor(
    private readonly grouper = new AngleGrouper(),
    private readonly fitter = new AngleFitter(),
    private readonly writer = new FindingsWriter(),
  ) {}

  async analyze(context: RunContext, product: Product, ads: readonly ReadAd[]): Promise<Omit<StageOutcome, "summary"> & { note: string }> {
    Trace.line(import.meta.url, "AdAnalysisStep.analyze", { ads: ads.length });
    const read = ads.filter((ad) => ad.reading);
    if (read.length === 0) return { status: "completed", error: "", note: "no read ads to analyse" };
    const asOf = context.run.created_at.slice(0, 10);
    const claims = product.claims_on_page.map((claim) => claim.text);
    const grouped = await this.grouper.group(context, read);
    if (grouped.status !== "completed") return AdAnalysisStep.stopped("angle grouper", grouped);
    await context.store.adAnalysis.saveAngles(context.run.id, grouped.value.angles);
    const angles: AdAngle[] = grouped.value.angles.map((angle) => ({ ...angle, fit: null, fit_claim_indexes: [], fit_why: null }));
    const fitted = await this.fitter.fit(context, product, AdsAnalyzer.analyze(ads, angles, [], claims, asOf).angles);
    if (fitted.status !== "completed") return AdAnalysisStep.stopped("fit check", fitted);
    await context.store.adAnalysis.saveFits(context.run.id, fitted.value.fits);
    const analysis = AdsAnalyzer.analyze(ads, await context.store.adAnalysis.angles(context.run.id), [], claims, asOf);
    const written = await this.writer.write(context, analysis, STAGE3_STEPS, ads.map((ad) => ad.id));
    if (written.status !== "completed") return AdAnalysisStep.stopped("findings writer", written);
    await context.store.adAnalysis.saveFindings(context.run.id, written.value.findings);
    return { status: "completed", error: "", note: `${analysis.angles.length} angles, ${analysis.proven} proven ads, ${written.value.findings.length} findings` };
  }

  private static stopped(who: string, result: Exclude<AgentResult<unknown>, { status: "completed" }>): Omit<StageOutcome, "summary"> & { note: string } {
    Trace.line(import.meta.url, "AdAnalysisStep.stopped", { who, status: result.status });
    const why = result.status === "invalid" ? result.problems.join("; ") : result.status === "failed" ? result.error : "stopped";
    return { status: result.status === "invalid" ? "invalid" : "failed", error: `${who}: ${why}`, note: `${who} did not finish` };
  }
}
