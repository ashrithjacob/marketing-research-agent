import type { MarketAssessment, MarketStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** Stage 4's assessment, one row per run in `market_assessments`: the stage and confidence as columns, the counted claims, awareness and evidence in `evidence`. The single `awareness_level` column holds the level most of the evidence sits at. */
export class MarketTable implements MarketStore {
  constructor(private readonly db: SqlDatabase) {}

  async save(accountId: string, assessment: MarketAssessment): Promise<void> {
    Trace.line(import.meta.url, "MarketTable.save", { runId: assessment.run_id, stage: assessment.sophistication_stage });
    const { run_id, sophistication_stage, confidence, ...evidence } = assessment;
    await this.db.run(
      "INSERT INTO market_assessments (run_id, account_id, sophistication_stage, awareness_level, confidence, evidence) VALUES (?,?,?,?,?,?)" +
        " ON CONFLICT (run_id) DO UPDATE SET sophistication_stage = EXCLUDED.sophistication_stage, awareness_level = EXCLUDED.awareness_level," +
        " confidence = EXCLUDED.confidence, evidence = EXCLUDED.evidence",
      [run_id, accountId, sophistication_stage, MarketTable.dominant(assessment), confidence, JSON.stringify(evidence)],
    );
  }

  async get(runId: string): Promise<MarketAssessment | null> {
    Trace.line(import.meta.url, "MarketTable.get", { runId });
    const row = await this.db.get<{ run_id: string; sophistication_stage: number; confidence: string; evidence: Omit<MarketAssessment, "run_id" | "sophistication_stage" | "confidence"> | string }>(
      "SELECT run_id, sophistication_stage, confidence, evidence FROM market_assessments WHERE run_id = ?",
      [runId],
    );
    if (!row) return null;
    const evidence = typeof row.evidence === "string" ? JSON.parse(row.evidence) : row.evidence;
    return { run_id: row.run_id, sophistication_stage: Number(row.sophistication_stage), confidence: row.confidence, ...evidence };
  }

  static dominant(assessment: MarketAssessment): string {
    Trace.line(import.meta.url, "MarketTable.dominant", { items: assessment.evidence.length });
    const counts = new Map<string, number>();
    for (const item of assessment.evidence) if (item.awareness) counts.set(item.awareness, (counts.get(item.awareness) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
  }
}
