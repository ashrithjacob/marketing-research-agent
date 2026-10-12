import { Clock, Ids, type ConvertedDocument, type DocumentLibrary, type DocumentStatus, type LibraryDocument, type Scope } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";

/** Uploaded documents and their markdown, one row each; a listing never reads the markdown. */
export class DocumentTable implements DocumentLibrary {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_documents (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title        TEXT NOT NULL,
    filename     TEXT NOT NULL,
    status       TEXT NOT NULL,
    pages        INTEGER NOT NULL DEFAULT 0,
    chars        INTEGER NOT NULL DEFAULT 0,
    markdown     TEXT NOT NULL DEFAULT '',
    error        TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS research_documents_workspace ON research_documents(workspace_id, created_at);
`;

  private static readonly COLUMNS = "id, workspace_id, title, filename, status, pages, chars, error, created_at, updated_at";

  constructor(private readonly db: SqlDatabase) {}

  async add(workspaceId: string, input: { title: string; filename: string }): Promise<LibraryDocument> {
    Trace.line(import.meta.url, "DocumentTable.add", { workspaceId, input });
    const now = Clock.nowIso();
    const document: LibraryDocument = {
      id: Ids.next(),
      workspace_id: workspaceId,
      title: input.title,
      filename: input.filename,
      status: "converting",
      pages: 0,
      chars: 0,
      error: "",
      created_at: now,
      updated_at: now,
    };
    await this.db.run(
      `INSERT INTO research_documents (${DocumentTable.COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [document.id, workspaceId, document.title, document.filename, document.status, 0, 0, "", now, now],
    );
    return document;
  }

  async finish(documentId: string, converted: ConvertedDocument): Promise<LibraryDocument> {
    Trace.line(import.meta.url, "DocumentTable.finish", { documentId, pages: converted.pages });
    await this.db.run(
      "UPDATE research_documents SET status = 'ready', markdown = ?, pages = ?, chars = ?, updated_at = ? WHERE id = ?",
      [converted.markdown, converted.pages, converted.markdown.length, Clock.nowIso(), documentId],
    );
    return this.byId(documentId);
  }

  async fail(documentId: string, error: string): Promise<LibraryDocument> {
    Trace.line(import.meta.url, "DocumentTable.fail", { documentId, error });
    await this.db.run(
      "UPDATE research_documents SET status = 'failed', error = ?, updated_at = ? WHERE id = ?",
      [error, Clock.nowIso(), documentId],
    );
    return this.byId(documentId);
  }

  async failConverting(error: string): Promise<number> {
    Trace.line(import.meta.url, "DocumentTable.failConverting", { error });
    return this.db.run(
      "UPDATE research_documents SET status = 'failed', error = ?, updated_at = ? WHERE status = 'converting'",
      [error, Clock.nowIso()],
    );
  }

  async list(scope: Scope): Promise<LibraryDocument[]> {
    Trace.line(import.meta.url, "DocumentTable.list", { scope });
    const rows = await this.db.all(
      `SELECT ${DocumentTable.COLUMNS} FROM research_documents WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC`,
      ScopeFilter.args(scope),
    );
    return rows.map((row) => DocumentTable.document(row));
  }

  async get(scope: Scope, documentId: string): Promise<LibraryDocument | null> {
    Trace.line(import.meta.url, "DocumentTable.get", { scope, documentId });
    const row = await this.db.get(
      `SELECT ${DocumentTable.COLUMNS} FROM research_documents WHERE id = ? AND ${ScopeFilter.sql("workspace_id")}`,
      [documentId, ...ScopeFilter.args(scope)],
    );
    return row ? DocumentTable.document(row) : null;
  }

  async markdown(scope: Scope, documentId: string): Promise<string | null> {
    Trace.line(import.meta.url, "DocumentTable.markdown", { scope, documentId });
    const row = await this.db.get<{ markdown: string }>(
      `SELECT markdown FROM research_documents WHERE id = ? AND status = 'ready' AND ${ScopeFilter.sql("workspace_id")}`,
      [documentId, ...ScopeFilter.args(scope)],
    );
    return row ? row.markdown : null;
  }

  async delete(scope: Scope, documentId: string): Promise<boolean> {
    Trace.line(import.meta.url, "DocumentTable.delete", { scope, documentId });
    const changed = await this.db.run(
      `DELETE FROM research_documents WHERE id = ? AND ${ScopeFilter.sql("workspace_id")}`,
      [documentId, ...ScopeFilter.args(scope)],
    );
    return changed > 0;
  }

  private async byId(documentId: string): Promise<LibraryDocument> {
    Trace.line(import.meta.url, "DocumentTable.byId", { documentId });
    const row = await this.db.get(`SELECT ${DocumentTable.COLUMNS} FROM research_documents WHERE id = ?`, [documentId]);
    if (!row) throw new Error(`no document ${documentId}`);
    return DocumentTable.document(row);
  }

  private static document(row: Record<string, unknown>): LibraryDocument {
    Trace.line(import.meta.url, "DocumentTable.document");
    return {
      id: row.id as string,
      workspace_id: row.workspace_id as string,
      title: row.title as string,
      filename: row.filename as string,
      status: row.status as DocumentStatus,
      pages: Number(row.pages),
      chars: Number(row.chars),
      error: row.error as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}
