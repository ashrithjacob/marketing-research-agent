import { Clock, type Playbook, type PlaybookBody, type PlaybookBook, type PlaybookStatus, type Scope } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";

type PlaybookRow = { workspace_id: string; key: string; version: number; body: string; by: string; lesson_id: string; status: string; created_at: string };

/** Each workspace's playbooks, one row per version; the newest version of a key is the playbook. */
export class PlaybookTable implements PlaybookBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_playbooks (
    workspace_id TEXT NOT NULL,
    key          TEXT NOT NULL,
    version      INTEGER NOT NULL,
    body         TEXT NOT NULL,
    by           TEXT NOT NULL,
    lesson_id    TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TEXT NOT NULL,
    PRIMARY KEY (workspace_id, key, version)
);
`;

  constructor(private readonly db: SqlDatabase) {}

  async current(scope: Scope, key: string): Promise<Playbook | null> {
    Trace.line(import.meta.url, "PlaybookTable.current", { key });
    const row = await this.db.get<PlaybookRow>(`SELECT * FROM research_playbooks WHERE key = ? AND ${ScopeFilter.sql("workspace_id")} ORDER BY version DESC LIMIT 1`, [key, ...ScopeFilter.args(scope)]);
    return row ? PlaybookTable.playbook(row) : null;
  }

  async at(scope: Scope, key: string, version: number): Promise<Playbook | null> {
    Trace.line(import.meta.url, "PlaybookTable.at", { key, version });
    const row = await this.db.get<PlaybookRow>(`SELECT * FROM research_playbooks WHERE key = ? AND version = ? AND ${ScopeFilter.sql("workspace_id")}`, [key, version, ...ScopeFilter.args(scope)]);
    return row ? PlaybookTable.playbook(row) : null;
  }

  async list(workspaceId: string): Promise<Playbook[]> {
    Trace.line(import.meta.url, "PlaybookTable.list", { workspaceId });
    const rows = await this.db.all<PlaybookRow>(
      "SELECT p.* FROM research_playbooks p WHERE p.workspace_id = ? AND p.version = (SELECT MAX(version) FROM research_playbooks q WHERE q.workspace_id = p.workspace_id AND q.key = p.key) ORDER BY p.key",
      [workspaceId],
    );
    return rows.map(PlaybookTable.playbook);
  }

  async history(workspaceId: string, key: string): Promise<Playbook[]> {
    Trace.line(import.meta.url, "PlaybookTable.history", { workspaceId, key });
    const rows = await this.db.all<PlaybookRow>("SELECT * FROM research_playbooks WHERE workspace_id = ? AND key = ? ORDER BY version DESC", [workspaceId, key]);
    return rows.map(PlaybookTable.playbook);
  }

  async add(workspaceId: string, body: PlaybookBody, by: Playbook["by"], lessonId: string): Promise<Playbook> {
    Trace.line(import.meta.url, "PlaybookTable.add", { workspaceId, key: body.key, by });
    const top = await this.db.get<{ version: number | null }>("SELECT MAX(version) AS version FROM research_playbooks WHERE workspace_id = ? AND key = ?", [workspaceId, body.key]);
    const playbook: Playbook = { ...body, workspace_id: workspaceId, version: (top?.version ?? 0) + 1, by, lesson_id: lessonId, status: "active", created_at: Clock.nowIso() };
    await this.db.run(
      "INSERT INTO research_playbooks (workspace_id, key, version, body, by, lesson_id, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [workspaceId, body.key, playbook.version, JSON.stringify(PlaybookTable.body(body)), by, lessonId, "active", playbook.created_at],
    );
    return playbook;
  }

  async mark(workspaceId: string, key: string, status: PlaybookStatus): Promise<void> {
    Trace.line(import.meta.url, "PlaybookTable.mark", { workspaceId, key, status });
    await this.db.run(
      "UPDATE research_playbooks SET status = ? WHERE workspace_id = ? AND key = ? AND version = (SELECT MAX(version) FROM research_playbooks WHERE workspace_id = ? AND key = ?)",
      [status, workspaceId, key, workspaceId, key],
    );
  }

  private static body(body: PlaybookBody): PlaybookBody {
    Trace.line(import.meta.url, "PlaybookTable.body", { key: body.key });
    const { key, title, primitive, document_title, read_first, sections, criteria } = body;
    return { key, title, primitive, document_title, read_first, sections, criteria };
  }

  private static playbook(row: PlaybookRow): Playbook {
    Trace.tick(import.meta.url, "PlaybookTable.playbook");
    const body = JSON.parse(row.body) as PlaybookBody;
    return { ...body, key: row.key, workspace_id: row.workspace_id, version: row.version, by: row.by as Playbook["by"], lesson_id: row.lesson_id, status: row.status as PlaybookStatus, created_at: row.created_at };
  }
}
