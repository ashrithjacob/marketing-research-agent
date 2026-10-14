import { Clock, FeedbackStrengths, Ids, type Feedback, type FeedbackBook, type FeedbackDraft, type Scope } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";

type FeedbackRow = Omit<Feedback, "target" | "diff"> & { target: string; diff: string };

/** Feedback, one row per owner action, with what it was about and any diff as JSON. Written once, never changed. */
export class FeedbackTable implements FeedbackBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_feedback (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    verdict      TEXT NOT NULL,
    strength     TEXT NOT NULL,
    target       TEXT NOT NULL,
    text         TEXT NOT NULL DEFAULT '',
    diff         TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS research_feedback_workspace ON research_feedback(workspace_id, created_at);
`;

  constructor(private readonly db: SqlDatabase) {}

  async record(workspaceId: string, draft: FeedbackDraft): Promise<Feedback> {
    Trace.line(import.meta.url, "FeedbackTable.record", { workspaceId, verdict: draft.verdict, target: draft.target.kind });
    const feedback: Feedback = {
      id: Ids.next(),
      workspace_id: workspaceId,
      verdict: draft.verdict,
      strength: FeedbackStrengths.of(draft.verdict),
      target: draft.target,
      text: draft.text,
      diff: draft.diff ?? null,
      created_at: Clock.nowIso(),
    };
    await this.db.run(
      "INSERT INTO research_feedback (id, workspace_id, verdict, strength, target, text, diff, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [feedback.id, workspaceId, feedback.verdict, feedback.strength, JSON.stringify(feedback.target), feedback.text, feedback.diff ? JSON.stringify(feedback.diff) : "", feedback.created_at],
    );
    return feedback;
  }

  async list(scope: Scope, limit: number): Promise<Feedback[]> {
    Trace.line(import.meta.url, "FeedbackTable.list", { limit });
    const rows = await this.db.all<FeedbackRow>(
      `SELECT * FROM research_feedback WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC LIMIT ?`,
      [...ScopeFilter.args(scope), limit],
    );
    return rows.map((row) => ({ ...row, target: JSON.parse(row.target) as Feedback["target"], diff: row.diff ? (JSON.parse(row.diff) as Feedback["diff"]) : null }));
  }
}
