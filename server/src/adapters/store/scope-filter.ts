import type { Scope } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** The WHERE fragment that keeps a read inside a scope, and the two parameters it binds; the cast lets Postgres type a parameter that may be null. */
export class ScopeFilter {
  static sql(column: string): string {
    Trace.line(import.meta.url, "ScopeFilter.sql", { column });
    return `(CAST(? AS TEXT) IS NULL OR ${column} = ?)`;
  }

  static args(scope: Scope): [string | null, string | null] {
    Trace.line(import.meta.url, "ScopeFilter.args", { scope });
    return [scope.workspaceId, scope.workspaceId];
  }
}
