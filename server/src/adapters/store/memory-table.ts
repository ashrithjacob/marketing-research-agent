import { Clock, Ids, type MemoryBook, type MemoryEntry, type MemoryWrite, type Scope } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";

type MemoryRow = Omit<MemoryEntry, "deleted"> & { deleted: number };

/** Brand memory, one row per version of an entry; the newest version of each is the entry. */
export class MemoryTable implements MemoryBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_memory (
    entry_id     TEXT NOT NULL,
    version      INTEGER NOT NULL,
    workspace_id TEXT NOT NULL,
    text         TEXT NOT NULL,
    by           TEXT NOT NULL,
    lesson_id    TEXT NOT NULL DEFAULT '',
    deleted      INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    PRIMARY KEY (entry_id, version)
);
CREATE INDEX IF NOT EXISTS research_memory_workspace ON research_memory(workspace_id, created_at);
`;

  constructor(private readonly db: SqlDatabase) {}

  async current(scope: Scope): Promise<MemoryEntry[]> {
    Trace.line(import.meta.url, "MemoryTable.current");
    const rows = await this.history(scope, 5000);
    const newest = new Map<string, MemoryEntry>();
    for (const row of rows) if (!newest.has(row.entry_id)) newest.set(row.entry_id, row);
    return [...newest.values()].filter((entry) => !entry.deleted).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async history(scope: Scope, limit: number): Promise<MemoryEntry[]> {
    Trace.line(import.meta.url, "MemoryTable.history", { limit });
    const rows = await this.db.all<MemoryRow>(
      `SELECT * FROM research_memory WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC, version DESC LIMIT ?`,
      [...ScopeFilter.args(scope), limit],
    );
    return rows.map((row) => ({ ...row, deleted: row.deleted === 1 }));
  }

  async write(workspaceId: string, change: MemoryWrite): Promise<MemoryEntry> {
    Trace.line(import.meta.url, "MemoryTable.write", { workspaceId, by: change.by, deleted: change.deleted === true });
    const entryId = change.entry_id ?? Ids.next();
    const last = await this.db.get<{ version: number }>("SELECT MAX(version) AS version FROM research_memory WHERE entry_id = ?", [entryId]);
    const entry: MemoryEntry = {
      entry_id: entryId,
      version: (last?.version ?? 0) + 1,
      workspace_id: workspaceId,
      text: change.text,
      by: change.by,
      lesson_id: change.lesson_id ?? "",
      deleted: change.deleted === true,
      created_at: Clock.nowIso(),
    };
    await this.db.run(
      "INSERT INTO research_memory (entry_id, version, workspace_id, text, by, lesson_id, deleted, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [entry.entry_id, entry.version, workspaceId, entry.text, entry.by, entry.lesson_id, entry.deleted ? 1 : 0, entry.created_at],
    );
    return entry;
  }
}
