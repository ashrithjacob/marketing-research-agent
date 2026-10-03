import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import { Trace } from "../../trace/index.js";

import type { SqlDatabase, SqlRow, SqlValue } from "./sql-database.js";

/** Statements run on the connection as they are called: the inside of a transaction, where nothing else may interleave. */
export class SqliteStatements implements SqlDatabase {
  constructor(private readonly db: Database.Database) {}

  async all<T = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    Trace.tick(import.meta.url, "SqliteStatements.all");
    return this.db.prepare(sql).all(...params) as T[];
  }

  async get<T = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
    Trace.tick(import.meta.url, "SqliteStatements.get");
    return (this.db.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<number> {
    Trace.tick(import.meta.url, "SqliteStatements.run");
    return this.db.prepare(sql).run(...params).changes;
  }

  async exec(script: string): Promise<void> {
    Trace.line(import.meta.url, "SqliteStatements.exec");
    this.db.exec(script);
  }

  async columns(table: string): Promise<string[]> {
    Trace.line(import.meta.url, "SqliteStatements.columns", { table });
    return (this.db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((row) => row.name);
  }

  async transaction<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    Trace.line(import.meta.url, "SqliteStatements.transaction");
    return work(this);
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "SqliteStatements.close");
    this.db.close();
  }
}

/** A SQLite file, one operation at a time: a transaction's awaits would otherwise let another caller's statements run inside it. */
export class SqliteDatabase implements SqlDatabase {
  private turn: Promise<unknown> = Promise.resolve();
  private readonly statements: SqliteStatements;

  constructor(private readonly db: Database.Database) {
    Trace.line(import.meta.url, "SqliteDatabase.constructor");
    this.statements = new SqliteStatements(db);
  }

  static open(path: string): SqliteDatabase {
    Trace.line(import.meta.url, "SqliteDatabase.open", { path });
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path, { timeout: 15000 });
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 15000");
    db.pragma("foreign_keys = ON");
    return new SqliteDatabase(db);
  }

  all<T = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    Trace.tick(import.meta.url, "SqliteDatabase.all");
    return this.queued(() => this.statements.all<T>(sql, params));
  }

  get<T = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T | null> {
    Trace.tick(import.meta.url, "SqliteDatabase.get");
    return this.queued(() => this.statements.get<T>(sql, params));
  }

  run(sql: string, params?: readonly SqlValue[]): Promise<number> {
    Trace.tick(import.meta.url, "SqliteDatabase.run");
    return this.queued(() => this.statements.run(sql, params));
  }

  exec(script: string): Promise<void> {
    Trace.line(import.meta.url, "SqliteDatabase.exec");
    return this.queued(() => this.statements.exec(script));
  }

  columns(table: string): Promise<string[]> {
    Trace.line(import.meta.url, "SqliteDatabase.columns", { table });
    return this.queued(() => this.statements.columns(table));
  }

  transaction<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    Trace.line(import.meta.url, "SqliteDatabase.transaction");
    return this.queued(async () => {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const result = await work(this.statements);
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    });
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "SqliteDatabase.close");
    await this.queued(() => this.statements.close());
  }

  private queued<T>(operation: () => Promise<T>): Promise<T> {
    Trace.tick(import.meta.url, "SqliteDatabase.queued");
    const next = this.turn.then(operation);
    this.turn = next.catch(() => undefined);
    return next;
  }
}
