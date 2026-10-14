import { Clock, Ids, type Draft, type DraftBook, type DraftSection, type DraftStatus, type Scope, type Verdict } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";

type DraftRow = Omit<Draft, "sections" | "verdicts"> & { sections: string; verdicts: string };

/** Drafts, one row per version; the newest version of a draft is the draft. */
export class DraftTable implements DraftBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_drafts (
    id           TEXT NOT NULL,
    version      INTEGER NOT NULL,
    workspace_id TEXT NOT NULL,
    run_id       TEXT NOT NULL,
    playbook     TEXT NOT NULL,
    playbook_version INTEGER NOT NULL DEFAULT 1,
    sections     TEXT NOT NULL,
    by           TEXT NOT NULL,
    status       TEXT NOT NULL,
    verdicts     TEXT NOT NULL DEFAULT '[]',
    created_at   TEXT NOT NULL,
    PRIMARY KEY (id, version)
);
CREATE INDEX IF NOT EXISTS research_drafts_run ON research_drafts(run_id);
`;

  constructor(private readonly db: SqlDatabase) {}

  async write(workspaceId: string, runId: string, playbook: { key: string; version: number }, section: DraftSection): Promise<Draft> {
    Trace.line(import.meta.url, "DraftTable.write", { runId, section: section.key });
    const current = await this.ofRun(runId);
    if (!current) {
      const draft: Draft = { id: Ids.next(), version: 1, workspace_id: workspaceId, run_id: runId, playbook: playbook.key, playbook_version: playbook.version, sections: [section], by: "writer", status: "writing", verdicts: [], created_at: Clock.nowIso() };
      await this.insert(draft);
      return draft;
    }
    const sections = [...current.sections.filter((s) => s.key !== section.key), section];
    await this.db.run("UPDATE research_drafts SET sections = ? WHERE id = ? AND version = ?", [JSON.stringify(sections), current.id, current.version]);
    return { ...current, sections };
  }

  async ofRun(runId: string): Promise<Draft | null> {
    Trace.line(import.meta.url, "DraftTable.ofRun", { runId });
    const row = await this.db.get<DraftRow>("SELECT * FROM research_drafts WHERE run_id = ? ORDER BY version DESC LIMIT 1", [runId]);
    return row ? DraftTable.draft(row) : null;
  }

  async get(scope: Scope, draftId: string): Promise<Draft | null> {
    Trace.line(import.meta.url, "DraftTable.get", { draftId });
    const row = await this.db.get<DraftRow>(`SELECT * FROM research_drafts WHERE id = ? AND ${ScopeFilter.sql("workspace_id")} ORDER BY version DESC LIMIT 1`, [draftId, ...ScopeFilter.args(scope)]);
    return row ? DraftTable.draft(row) : null;
  }

  async list(scope: Scope, limit: number): Promise<Draft[]> {
    Trace.line(import.meta.url, "DraftTable.list", { limit });
    const rows = await this.db.all<DraftRow>(`SELECT * FROM research_drafts WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC, version DESC LIMIT ?`, [...ScopeFilter.args(scope), limit * 5]);
    const newest = new Map<string, Draft>();
    for (const row of rows) if (!newest.has(row.id)) newest.set(row.id, DraftTable.draft(row));
    return [...newest.values()].slice(0, limit);
  }

  async edit(draftId: string, sections: DraftSection[]): Promise<Draft> {
    Trace.line(import.meta.url, "DraftTable.edit", { draftId });
    const current = (await this.db.get<DraftRow>("SELECT * FROM research_drafts WHERE id = ? ORDER BY version DESC LIMIT 1", [draftId]))!;
    const draft: Draft = { ...DraftTable.draft(current), version: current.version + 1, sections, by: "owner", created_at: Clock.nowIso() };
    await this.insert(draft);
    return draft;
  }

  async mark(draftId: string, status: DraftStatus, verdicts?: Verdict[]): Promise<void> {
    Trace.line(import.meta.url, "DraftTable.mark", { draftId, status });
    const sets = verdicts ? "status = ?, verdicts = ?" : "status = ?";
    const args = verdicts ? [status, JSON.stringify(verdicts)] : [status];
    await this.db.run(`UPDATE research_drafts SET ${sets} WHERE id = ? AND version = (SELECT MAX(version) FROM research_drafts WHERE id = ?)`, [...args, draftId, draftId]);
  }

  private async insert(draft: Draft): Promise<void> {
    Trace.line(import.meta.url, "DraftTable.insert", { id: draft.id, version: draft.version });
    await this.db.run(
      "INSERT INTO research_drafts (id, version, workspace_id, run_id, playbook, playbook_version, sections, by, status, verdicts, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [draft.id, draft.version, draft.workspace_id, draft.run_id, draft.playbook, draft.playbook_version, JSON.stringify(draft.sections), draft.by, draft.status, JSON.stringify(draft.verdicts), draft.created_at],
    );
  }

  private static draft(row: DraftRow): Draft {
    Trace.tick(import.meta.url, "DraftTable.draft");
    return { ...row, sections: JSON.parse(row.sections) as DraftSection[], verdicts: JSON.parse(row.verdicts) as Verdict[], by: row.by as Draft["by"], status: row.status as DraftStatus };
  }
}
