import pg from "pg";

import { Trace } from "../../trace/index.js";

/** `?` placeholders numbered for Postgres, and the column types read back as the plain values the domain uses. */
export class PostgresDialect {
  static readonly INT8 = 20;
  static readonly TIMESTAMPTZ = 1184;

  static statement(sql: string): string {
    Trace.tick(import.meta.url, "PostgresDialect.statement");
    let n = 0;
    return sql.replace(/'(?:[^']|'')*'|\?/g, (token) => (token === "?" ? `$${++n}` : token));
  }

  static parser(oid: number, format?: string): (value: string) => unknown {
    Trace.tick(import.meta.url, "PostgresDialect.parser");
    if (oid === PostgresDialect.INT8) return Number;
    if (oid === PostgresDialect.TIMESTAMPTZ) return (value: string) => new Date(value).toISOString();
    return pg.types.getTypeParser(oid, format as "text");
  }
}
