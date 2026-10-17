import {
  ADMIN_ACCOUNT,
  Ids,
  type Account,
  type AccountDirectory,
  type User,
  type UserListing,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** Client accounts and their logins; a password change or a disable bumps `token_version`, which ends every session. */
export class AccountTable implements AccountDirectory {
  constructor(private readonly db: SqlDatabase) {}

  async addAccount(name: string): Promise<Account> {
    Trace.line(import.meta.url, "AccountTable.addAccount", { name });
    return this.insertAccount(Ids.next(), name);
  }

  async account(id: string): Promise<Account | null> {
    Trace.line(import.meta.url, "AccountTable.account", { id });
    return this.db.get<Account>("SELECT * FROM accounts WHERE id = ?", [id]);
  }

  async accountNamed(name: string): Promise<Account | null> {
    Trace.line(import.meta.url, "AccountTable.accountNamed", { name });
    return this.db.get<Account>("SELECT * FROM accounts WHERE name = ?", [name]);
  }

  async addUser(input: { username: string; passwordHash: string; accountId: string; isAdmin: boolean }): Promise<User> {
    Trace.line(import.meta.url, "AccountTable.addUser", { username: input.username, accountId: input.accountId });
    const id = Ids.next();
    await this.db.run("INSERT INTO users (id, username, password_hash, account_id, is_admin) VALUES (?,?,?,?,?)", [
      id,
      input.username,
      input.passwordHash,
      input.accountId,
      input.isAdmin,
    ]);
    return (await this.user(id))!;
  }

  async user(userId: string): Promise<User | null> {
    Trace.line(import.meta.url, "AccountTable.user", { userId });
    return this.db.get<User>("SELECT * FROM users WHERE id = ?", [userId]);
  }

  async byUsername(username: string): Promise<User | null> {
    Trace.line(import.meta.url, "AccountTable.byUsername", { username });
    return this.db.get<User>("SELECT * FROM users WHERE username = ?", [username]);
  }

  async users(): Promise<UserListing[]> {
    Trace.line(import.meta.url, "AccountTable.users");
    return this.db.all<UserListing>(
      "SELECT u.username, a.name AS account, u.is_admin, u.disabled, u.created_at" +
        " FROM users u JOIN accounts a ON a.id = u.account_id ORDER BY a.name, u.username",
    );
  }

  async setPassword(username: string, passwordHash: string): Promise<boolean> {
    Trace.line(import.meta.url, "AccountTable.setPassword", { username });
    return this.change("password_hash = ?", passwordHash, username);
  }

  async setDisabled(username: string, disabled: boolean): Promise<boolean> {
    Trace.line(import.meta.url, "AccountTable.setDisabled", { username, disabled });
    return this.change("disabled = ?", disabled, username);
  }

  async revokeSessions(userId: string): Promise<void> {
    Trace.line(import.meta.url, "AccountTable.revokeSessions", { userId });
    await this.db.run("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [userId]);
  }

  async seedAdmin(username: string, passwordHash: string): Promise<boolean> {
    Trace.line(import.meta.url, "AccountTable.seedAdmin", { username });
    const count = await this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM users");
    if (count!.n > 0 || !passwordHash) return false;
    await this.addUser({ username, passwordHash, accountId: ADMIN_ACCOUNT, isAdmin: true });
    return true;
  }

  private async insertAccount(id: string, name: string): Promise<Account> {
    Trace.line(import.meta.url, "AccountTable.insertAccount", { id, name });
    await this.db.run("INSERT INTO accounts (id, name) VALUES (?,?)", [id, name]);
    return (await this.account(id))!;
  }

  private async change(assignment: string, value: string | boolean, username: string): Promise<boolean> {
    Trace.line(import.meta.url, "AccountTable.change", { assignment, username });
    const changed = await this.db.run(`UPDATE users SET ${assignment}, token_version = token_version + 1 WHERE username = ?`, [
      value,
      username,
    ]);
    return changed > 0;
  }
}
