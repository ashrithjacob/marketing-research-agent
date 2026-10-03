import { Clock, type ReviewAnalysis } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** One review analysis per review-mining run, kept whole as it was last written. */
export class ReviewAnalysisTable {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_review_analyses (
    run_id     TEXT PRIMARY KEY REFERENCES research_runs(id) ON DELETE CASCADE,
    status     TEXT NOT NULL,
    body       TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
`;

  constructor(private readonly db: SqlDatabase) {}

  async save(analysis: ReviewAnalysis): Promise<void> {
    Trace.line(import.meta.url, "ReviewAnalysisTable.save", { runId: analysis.run_id, status: analysis.status });
    await this.db.run(
      "INSERT INTO research_review_analyses (run_id, status, body, updated_at) VALUES (?,?,?,?)" +
        " ON CONFLICT(run_id) DO UPDATE SET status = excluded.status, body = excluded.body," +
        " updated_at = excluded.updated_at",
      [analysis.run_id, analysis.status, JSON.stringify(analysis), Clock.nowIso()],
    );
  }

  async get(runId: string): Promise<ReviewAnalysis | null> {
    Trace.line(import.meta.url, "ReviewAnalysisTable.get", { runId });
    const row = await this.db.get<{ body: string }>("SELECT body FROM research_review_analyses WHERE run_id = ?", [runId]);
    return row ? (JSON.parse(row.body) as ReviewAnalysis) : null;
  }
}
