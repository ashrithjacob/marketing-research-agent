import { createHash } from "node:crypto";

import { Trace } from "../../trace/index.js";

import type { SqlDatabase, SqlRow, SqlValue } from "./sql-database.js";

export interface CopiedTable {
  table: string;
  rows: number;
  matches: boolean;
}

/** Copies every table the store owns from a SQLite file into an empty Postgres, parents before children, then proves each arrived row for row. */
export class StoreCopy {
  static readonly TABLES = [
    "research_migrations", "research_workspaces", "research_accounts", "research_products", "research_runs",
    "research_events", "research_packet_checks", "research_judgements", "research_reviews", "research_run_reviews",
    "research_llm_calls", "research_packet_sources", "research_packet_attributes", "research_packet_measurements",
    "research_packet_excerpts", "research_packet_competitors", "research_packet_gaps", "research_review_analyses",
    "research_target_listings", "research_findings", "research_charges", "research_review_pulls",
  ];

  static readonly RETIRED = new Set(["discovery_runs", "trendtrack_cache"]);

  private static readonly BATCH_ROWS = 200;
  private static readonly BATCH_CHARS = 4_000_000;

  constructor(
    private readonly from: SqlDatabase,
    private readonly to: SqlDatabase,
  ) {}

  /** The source tables the copy leaves behind, with their row counts; a table neither copied nor retired stops the copy. */
  async leftBehind(): Promise<Array<{ table: string; rows: number }>> {
    Trace.line(import.meta.url, "StoreCopy.leftBehind");
    const names = (await this.from.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite~_%' ESCAPE '~' ORDER BY name")).map((row) => row.name);
    const unknown = names.filter((name) => !StoreCopy.TABLES.includes(name) && !StoreCopy.RETIRED.has(name));
    if (unknown.length > 0) throw new Error(`tables the copy does not know: ${unknown.join(", ")}`);
    const retired = names.filter((name) => StoreCopy.RETIRED.has(name));
    return Promise.all(retired.map(async (table) => ({ table, rows: await this.count(this.from, table) })));
  }

  async copy(): Promise<CopiedTable[]> {
    Trace.line(import.meta.url, "StoreCopy.copy");
    if ((await this.count(this.to, "research_runs")) > 0) throw new Error("the target already holds runs; copy only into an empty database");
    await this.to.run("DELETE FROM research_migrations");
    for (const table of StoreCopy.TABLES) await this.copyTable(table);
    for (const table of StoreCopy.TABLES) await this.restartIdentity(table);
    const copied: CopiedTable[] = [];
    for (const table of StoreCopy.TABLES) {
      const columns = await this.from.columns(table);
      copied.push({ table, rows: await this.count(this.from, table), matches: (await this.digest(this.from, table, columns)) === (await this.digest(this.to, table, columns)) });
    }
    return copied;
  }

  private async copyTable(table: string): Promise<void> {
    Trace.line(import.meta.url, "StoreCopy.copyTable", { table });
    const columns = await this.from.columns(table);
    const target = new Set(await this.to.columns(table));
    const missing = columns.filter((column) => !target.has(column));
    if (missing.length > 0) throw new Error(`${table}: the target has no column ${missing.join(", ")}`);
    const rows = await this.from.all(`SELECT ${columns.join(", ")} FROM ${table}`);
    await this.to.transaction(async (tx) => {
      for (const batch of StoreCopy.batches(rows)) {
        const values = batch.map(() => `(${columns.map(() => "?").join(",")})`).join(", ");
        const params = batch.flatMap((row) => columns.map((column) => row[column] as SqlValue));
        await tx.run(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values} ON CONFLICT DO NOTHING`, params);
      }
    });
  }

  private async restartIdentity(table: string): Promise<void> {
    Trace.line(import.meta.url, "StoreCopy.restartIdentity", { table });
    if (!(await this.to.columns(table)).includes("id")) return;
    const sequence = await this.to.get<{ name: string | null }>("SELECT pg_get_serial_sequence(?, 'id') AS name", [table]);
    if (!sequence?.name) return;
    await this.to.get(`SELECT setval(?, (SELECT COALESCE(MAX(id), 0) + 1 FROM ${table}), false) AS next`, [sequence.name]);
  }

  private async count(db: SqlDatabase, table: string): Promise<number> {
    Trace.line(import.meta.url, "StoreCopy.count", { table });
    return Number((await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0);
  }

  private async digest(db: SqlDatabase, table: string, columns: string[]): Promise<string> {
    Trace.line(import.meta.url, "StoreCopy.digest", { table });
    const rows = await db.all(`SELECT ${columns.join(", ")} FROM ${table}`);
    const lines = rows.map((row) => JSON.stringify(columns.map((column) => row[column]))).sort();
    return createHash("sha256").update(lines.join("\n")).digest("hex");
  }

  private static *batches(rows: SqlRow[]): Generator<SqlRow[]> {
    Trace.line(import.meta.url, "StoreCopy.batches", { rows: rows.length });
    let batch: SqlRow[] = [];
    let chars = 0;
    for (const row of rows) {
      const size = Object.values(row).reduce((sum: number, value) => sum + (typeof value === "string" ? value.length : 8), 0);
      if (batch.length > 0 && (batch.length >= StoreCopy.BATCH_ROWS || chars + size > StoreCopy.BATCH_CHARS)) {
        yield batch;
        batch = [];
        chars = 0;
      }
      batch.push(row);
      chars += size;
    }
    if (batch.length > 0) yield batch;
  }
}
