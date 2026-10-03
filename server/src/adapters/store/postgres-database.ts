import pg from "pg";

import { Trace } from "../../trace/index.js";

import { PostgresDialect } from "./postgres-dialect.js";
import type { SqlDatabase, SqlRow, SqlValue } from "./sql-database.js";

type Queryable = pg.Pool | pg.PoolClient;

/** Statements on one Postgres connection or pool, written in the shared dialect and translated on the way. */
export class PostgresStatements implements SqlDatabase {
  constructor(private readonly target: Queryable) {}

  async all<T = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    Trace.tick(import.meta.url, "PostgresStatements.all");
    return (await this.target.query(PostgresDialect.statement(sql), [...params])).rows as T[];
  }

  async get<T = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
    Trace.tick(import.meta.url, "PostgresStatements.get");
    return (await this.all<T>(sql, params))[0] ?? null;
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<number> {
    Trace.tick(import.meta.url, "PostgresStatements.run");
    return (await this.target.query(PostgresDialect.statement(sql), [...params])).rowCount ?? 0;
  }

  async exec(script: string): Promise<void> {
    Trace.line(import.meta.url, "PostgresStatements.exec");
    await this.target.query(PostgresDialect.script(script));
  }

  async columns(table: string): Promise<string[]> {
    Trace.line(import.meta.url, "PostgresStatements.columns", { table });
    const rows = await this.all<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?",
      [table],
    );
    return rows.map((row) => row.column_name);
  }

  async transaction<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    Trace.line(import.meta.url, "PostgresStatements.transaction");
    return work(this);
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "PostgresStatements.close");
  }
}

/** A Postgres database through a pool; a transaction holds one connection from BEGIN to COMMIT. */
export class PostgresDatabase implements SqlDatabase {
  private readonly statements: PostgresStatements;

  constructor(private readonly pool: pg.Pool) {
    Trace.line(import.meta.url, "PostgresDatabase.constructor");
    this.statements = new PostgresStatements(pool);
  }

  static connect(url: string, connections: number): PostgresDatabase {
    Trace.line(import.meta.url, "PostgresDatabase.connect", { connections });
    return new PostgresDatabase(new pg.Pool({ connectionString: url, max: connections, types: { getTypeParser: PostgresDialect.parser } }));
  }

  all<T = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    Trace.tick(import.meta.url, "PostgresDatabase.all");
    return this.statements.all<T>(sql, params);
  }

  get<T = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T | null> {
    Trace.tick(import.meta.url, "PostgresDatabase.get");
    return this.statements.get<T>(sql, params);
  }

  run(sql: string, params?: readonly SqlValue[]): Promise<number> {
    Trace.tick(import.meta.url, "PostgresDatabase.run");
    return this.statements.run(sql, params);
  }

  exec(script: string): Promise<void> {
    Trace.line(import.meta.url, "PostgresDatabase.exec");
    return this.statements.exec(script);
  }

  columns(table: string): Promise<string[]> {
    Trace.line(import.meta.url, "PostgresDatabase.columns", { table });
    return this.statements.columns(table);
  }

  async transaction<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    Trace.line(import.meta.url, "PostgresDatabase.transaction");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(new PostgresStatements(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "PostgresDatabase.close");
    await this.pool.end();
  }
}
