import type { AdAnalysisStore, AdAngle, AdAngles, AdFinding, AngleFits } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** One run's ad angles (`ad_angles`, in the order the grouper gave them, with each angle's fit) and the findings written over them (`ad_findings`, one per step). Saving angles or findings replaces the run's previous ones. */
export class AdAnalysisTable implements AdAnalysisStore {
  constructor(private readonly db: SqlDatabase) {}

  async saveAngles(runId: string, angles: AdAngles["angles"]): Promise<void> {
    Trace.line(import.meta.url, "AdAnalysisTable.saveAngles", { runId, angles: angles.length });
    await this.db.transaction(async (tx) => {
      await tx.run("DELETE FROM ad_angles WHERE run_id = ?", [runId]);
      for (const [position, angle] of angles.entries()) {
        await tx.run("INSERT INTO ad_angles (run_id, key, position, name, description, ad_ids) VALUES (?,?,?,?,?,?)", [runId, angle.key, position, angle.name, angle.description, JSON.stringify(angle.ad_ids)]);
      }
    });
  }

  async saveFits(runId: string, fits: AngleFits["fits"]): Promise<void> {
    Trace.line(import.meta.url, "AdAnalysisTable.saveFits", { runId, fits: fits.length });
    await this.db.transaction(async (tx) => {
      for (const fit of fits) {
        await tx.run("UPDATE ad_angles SET fit = ?, fit_claim_indexes = ?, fit_why = ? WHERE run_id = ? AND key = ?", [fit.verdict, JSON.stringify(fit.claim_indexes), fit.why, runId, fit.angle_key]);
      }
    });
  }

  async saveFindings(runId: string, findings: readonly AdFinding[]): Promise<void> {
    Trace.line(import.meta.url, "AdAnalysisTable.saveFindings", { runId, findings: findings.length });
    await this.db.transaction(async (tx) => {
      for (const finding of findings) {
        await tx.run(
          "INSERT INTO ad_findings (run_id, step, subjects, headline, ad_ids) VALUES (?,?,?,?,?) ON CONFLICT (run_id, step) DO UPDATE SET subjects = EXCLUDED.subjects," +
            " headline = EXCLUDED.headline, ad_ids = EXCLUDED.ad_ids",
          [runId, finding.step, JSON.stringify(finding.subjects), finding.headline, JSON.stringify(finding.ad_ids)],
        );
      }
    });
  }

  async angles(runId: string): Promise<AdAngle[]> {
    Trace.line(import.meta.url, "AdAnalysisTable.angles", { runId });
    const rows = await this.db.all<Record<string, unknown>>("SELECT key, name, description, ad_ids, fit, fit_claim_indexes, fit_why FROM ad_angles WHERE run_id = ? ORDER BY position", [runId]);
    return rows.map((row) => ({
      key: String(row.key),
      name: String(row.name),
      description: String(row.description),
      ad_ids: AdAnalysisTable.json<string[]>(row.ad_ids),
      fit: (row.fit ?? null) as AdAngle["fit"],
      fit_claim_indexes: AdAnalysisTable.json<number[]>(row.fit_claim_indexes),
      fit_why: (row.fit_why ?? null) as string | null,
    }));
  }

  async findings(runId: string): Promise<AdFinding[]> {
    Trace.line(import.meta.url, "AdAnalysisTable.findings", { runId });
    const rows = await this.db.all<Record<string, unknown>>("SELECT step, subjects, headline, ad_ids FROM ad_findings WHERE run_id = ? ORDER BY step", [runId]);
    return rows.map((row) => ({ step: Number(row.step), subjects: AdAnalysisTable.json<string[]>(row.subjects), headline: String(row.headline), ad_ids: AdAnalysisTable.json<string[]>(row.ad_ids) }));
  }

  private static json<T>(value: unknown): T {
    Trace.tick(import.meta.url, "AdAnalysisTable.json");
    return (typeof value === "string" ? JSON.parse(value) : value) as T;
  }
}
