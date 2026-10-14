import { Clock, Ids, type Lesson, type LessonBook, type LessonChange, type LessonDraft, type Scope } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";

type LessonRow = Omit<Lesson, "change" | "feedback_ids"> & { change: string; feedback_ids: string };

/** Lessons the reviewer proposed, and the reviews that found nothing, each with the feedback behind it. */
export class LessonTable implements LessonBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_lessons (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    change       TEXT NOT NULL,
    why          TEXT NOT NULL,
    feedback_ids TEXT NOT NULL,
    status       TEXT NOT NULL,
    card_id      TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    resolved_at  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS research_lessons_workspace ON research_lessons(workspace_id, created_at);
`;

  constructor(private readonly db: SqlDatabase) {}

  async stage(workspaceId: string, draft: LessonDraft): Promise<Lesson> {
    Trace.line(import.meta.url, "LessonTable.stage", { workspaceId, status: draft.status });
    const lesson: Lesson = { id: Ids.next(), workspace_id: workspaceId, change: draft.change, why: draft.why, feedback_ids: draft.feedback_ids, status: draft.status, card_id: "", created_at: Clock.nowIso(), resolved_at: "" };
    await this.db.run(
      "INSERT INTO research_lessons (id, workspace_id, change, why, feedback_ids, status, card_id, created_at, resolved_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [lesson.id, workspaceId, JSON.stringify(lesson.change), lesson.why, JSON.stringify(lesson.feedback_ids), lesson.status, "", lesson.created_at, ""],
    );
    return lesson;
  }

  async get(scope: Scope, lessonId: string): Promise<Lesson | null> {
    Trace.line(import.meta.url, "LessonTable.get", { lessonId });
    const row = await this.db.get<LessonRow>(`SELECT * FROM research_lessons WHERE id = ? AND ${ScopeFilter.sql("workspace_id")}`, [lessonId, ...ScopeFilter.args(scope)]);
    return row ? LessonTable.lesson(row) : null;
  }

  async list(scope: Scope, limit: number): Promise<Lesson[]> {
    Trace.line(import.meta.url, "LessonTable.list", { limit });
    const rows = await this.db.all<LessonRow>(`SELECT * FROM research_lessons WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC LIMIT ?`, [...ScopeFilter.args(scope), limit]);
    return rows.map(LessonTable.lesson);
  }

  async attach(lessonId: string, cardId: string): Promise<void> {
    Trace.line(import.meta.url, "LessonTable.attach", { lessonId, cardId });
    await this.db.run("UPDATE research_lessons SET card_id = ? WHERE id = ?", [cardId, lessonId]);
  }

  async resolve(lessonId: string, status: "approved" | "rejected", change: LessonChange | null): Promise<Lesson | null> {
    Trace.line(import.meta.url, "LessonTable.resolve", { lessonId, status });
    const now = Clock.nowIso();
    await this.db.run("UPDATE research_lessons SET status = ?, change = ?, resolved_at = ? WHERE id = ? AND status = 'staged'", [status, JSON.stringify(change), now, lessonId]);
    const row = await this.db.get<LessonRow>("SELECT * FROM research_lessons WHERE id = ?", [lessonId]);
    return row && row.resolved_at === now ? LessonTable.lesson(row) : null;
  }

  private static lesson(row: LessonRow): Lesson {
    Trace.tick(import.meta.url, "LessonTable.lesson");
    return { ...row, change: JSON.parse(row.change) as LessonChange | null, feedback_ids: JSON.parse(row.feedback_ids) as string[], status: row.status as Lesson["status"] };
  }
}
