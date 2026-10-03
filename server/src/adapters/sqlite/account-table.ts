import type Database from "better-sqlite3";

import {
  ADMIN_WORKSPACE,
  Clock,
  Ids,
  type Account,
  type AccountDirectory,
  type AccountListing,
  type Workspace,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Workspaces and their logins; a password change or a disable bumps `token_version`, which ends every session. */
export class AccountTable implements AccountDirectory {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_workspaces (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL UNIQUE,
    billing_status TEXT NOT NULL DEFAULT 'exempt',
    created_at     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS research_accounts (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    workspace_id  TEXT NOT NULL REFERENCES research_workspaces(id),
    is_admin      INTEGER NOT NULL DEFAULT 0,
    token_version INTEGER NOT NULL DEFAULT 0,
    disabled      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
);`;

  constructor(private readonly db: Database.Database) {}

  async addWorkspace(name: string): Promise<Workspace> {
    Trace.line(import.meta.url, "AccountTable.addWorkspace", { name });
    return this.insertWorkspace(name, name);
  }

  async workspace(id: string): Promise<Workspace | null> {
    Trace.line(import.meta.url, "AccountTable.workspace", { id });
    return (this.db.prepare("SELECT * FROM research_workspaces WHERE id = ?").get(id) as Workspace) ?? null;
  }

  async workspaceNamed(name: string): Promise<Workspace | null> {
    Trace.line(import.meta.url, "AccountTable.workspaceNamed", { name });
    return (this.db.prepare("SELECT * FROM research_workspaces WHERE name = ?").get(name) as Workspace) ?? null;
  }

  async addAccount(input: { username: string; passwordHash: string; workspaceId: string; isAdmin: boolean }): Promise<Account> {
    Trace.line(import.meta.url, "AccountTable.addAccount", { input });
    const id = Ids.next();
    this.db
      .prepare(
        "INSERT INTO research_accounts (id, username, password_hash, workspace_id, is_admin, created_at)" +
          " VALUES (?,?,?,?,?,?)",
      )
      .run(id, input.username, input.passwordHash, input.workspaceId, input.isAdmin ? 1 : 0, Clock.nowIso());
    return (await this.get(id))!;
  }

  async get(accountId: string): Promise<Account | null> {
    Trace.line(import.meta.url, "AccountTable.get", { accountId });
    return AccountTable.account(this.db.prepare("SELECT * FROM research_accounts WHERE id = ?").get(accountId));
  }

  async byUsername(username: string): Promise<Account | null> {
    Trace.line(import.meta.url, "AccountTable.byUsername", { username });
    return AccountTable.account(
      this.db.prepare("SELECT * FROM research_accounts WHERE username = ?").get(username),
    );
  }

  async list(): Promise<AccountListing[]> {
    Trace.line(import.meta.url, "AccountTable.list");
    const rows = this.db
      .prepare(
        "SELECT a.username, w.name AS workspace, a.is_admin, a.disabled, a.created_at" +
          " FROM research_accounts a JOIN research_workspaces w ON w.id = a.workspace_id" +
          " ORDER BY w.name, a.username",
      )
      .all() as Array<Record<string, any>>;
    return rows.map((row) => ({ ...row, is_admin: Boolean(row.is_admin), disabled: Boolean(row.disabled) }) as AccountListing);
  }

  async setPassword(username: string, passwordHash: string): Promise<boolean> {
    Trace.line(import.meta.url, "AccountTable.setPassword", { username, passwordHash });
    return this.change("password_hash = ?", passwordHash, username);
  }

  async setDisabled(username: string, disabled: boolean): Promise<boolean> {
    Trace.line(import.meta.url, "AccountTable.setDisabled", { username, disabled });
    return this.change("disabled = ?", disabled ? 1 : 0, username);
  }

  async revokeSessions(accountId: string): Promise<void> {
    Trace.line(import.meta.url, "AccountTable.revokeSessions", { accountId });
    this.db.prepare("UPDATE research_accounts SET token_version = token_version + 1 WHERE id = ?").run(accountId);
  }

  async seedAdmin(username: string, passwordHash: string): Promise<boolean> {
    Trace.line(import.meta.url, "AccountTable.seedAdmin", { username, passwordHash });
    const count = this.db.prepare("SELECT COUNT(*) AS n FROM research_accounts").get() as { n: number };
    if (count.n > 0 || !passwordHash) return false;
    if (!(await this.workspace(ADMIN_WORKSPACE))) await this.insertWorkspace(ADMIN_WORKSPACE, ADMIN_WORKSPACE);
    await this.addAccount({ username, passwordHash, workspaceId: ADMIN_WORKSPACE, isAdmin: true });
    return true;
  }

  private async insertWorkspace(id: string, name: string): Promise<Workspace> {
    Trace.line(import.meta.url, "AccountTable.insertWorkspace", { id, name });
    this.db
      .prepare("INSERT INTO research_workspaces (id, name, created_at) VALUES (?,?,?)")
      .run(id, name, Clock.nowIso());
    return (await this.workspace(id))!;
  }

  private change(assignment: string, value: string | number, username: string): boolean {
    Trace.line(import.meta.url, "AccountTable.change", { assignment, value, username });
    const result = this.db
      .prepare(
        `UPDATE research_accounts SET ${assignment}, token_version = token_version + 1 WHERE username = ?`,
      )
      .run(value, username);
    return result.changes > 0;
  }

  private static account(row: unknown): Account | null {
    Trace.line(import.meta.url, "AccountTable.account", { row });
    if (!row) return null;
    const r = row as Record<string, any>;
    return { ...r, is_admin: Boolean(r.is_admin), disabled: Boolean(r.disabled) } as Account;
  }
}
