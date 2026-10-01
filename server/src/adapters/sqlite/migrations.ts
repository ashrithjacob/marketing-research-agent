import type Database from "better-sqlite3";

import { Trace } from "../../trace/index.js";

const MIGRATIONS: ReadonlyArray<readonly [string, string, string]> = [
  ["research_runs", "output", "ALTER TABLE research_runs ADD COLUMN output TEXT NOT NULL DEFAULT ''"],
  ["research_runs", "judgement_ids", "ALTER TABLE research_runs ADD COLUMN judgement_ids TEXT NOT NULL DEFAULT '[]'"],
  ["research_runs", "usage", "ALTER TABLE research_runs ADD COLUMN usage TEXT NOT NULL DEFAULT '{}'"],
  ["research_runs", "agent_run_id", "ALTER TABLE research_runs ADD COLUMN agent_run_id TEXT NOT NULL DEFAULT ''"],
  ["research_runs", "nodes", "ALTER TABLE research_runs ADD COLUMN nodes TEXT NOT NULL DEFAULT '[]'"],
  ["research_runs", "packet_source", "ALTER TABLE research_runs ADD COLUMN packet_source TEXT NOT NULL DEFAULT ''"],
  ["research_runs", "product_id", "ALTER TABLE research_runs ADD COLUMN product_id TEXT NOT NULL DEFAULT ''"],
  ["research_run_reviews", "product_id", "ALTER TABLE research_run_reviews ADD COLUMN product_id TEXT NOT NULL DEFAULT ''"],
  ["research_runs", "workspace_id", "ALTER TABLE research_runs ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'admin'"],
  ["research_judgements", "workspace_id", "ALTER TABLE research_judgements ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'admin'"],
  ["research_llm_calls", "generation", "ALTER TABLE research_llm_calls ADD COLUMN generation TEXT"],
  ["research_llm_calls", "agent_id", "ALTER TABLE research_llm_calls ADD COLUMN agent_id TEXT NOT NULL DEFAULT ''"],
  [
    "research_runs",
    "source_run_id",
    "ALTER TABLE research_runs ADD COLUMN source_run_id TEXT NOT NULL DEFAULT '';" +
      " UPDATE research_runs SET source_run_id = COALESCE((SELECT s.id FROM research_runs s" +
      " WHERE s.stage = 1 AND s.status = 'completed' AND s.product_id = research_runs.product_id" +
      " AND s.workspace_id = research_runs.workspace_id AND s.created_at <= research_runs.created_at" +
      " ORDER BY s.created_at DESC LIMIT 1), '') WHERE stage = 2",
  ],
];

const DATA_MIGRATIONS: ReadonlyArray<readonly [string, string]> = [
  [
    "review-mining-is-stage-3",
    "UPDATE research_runs SET stage = 3, packet = CASE WHEN json_valid(packet)" +
      " THEN json_set(packet, '$.stage', 3) ELSE packet END WHERE stage = 2",
  ],
];

/** CREATE TABLE IF NOT EXISTS never alters an existing table, so columns migrate here; a change to rows already stored runs once, by name. */
export class SqliteMigrations {
  static apply(db: Database.Database): void {
    Trace.line(import.meta.url, "SqliteMigrations.apply");
    for (const [table, column, ddl] of MIGRATIONS) {
      const have = (db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((row) => row.name);
      if (!have.includes(column)) db.exec(ddl);
    }
    SqliteMigrations.data(db);
  }

  private static data(db: Database.Database): void {
    Trace.line(import.meta.url, "SqliteMigrations.data");
    db.exec("CREATE TABLE IF NOT EXISTS research_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    const applied = new Set((db.prepare("SELECT name FROM research_migrations").all() as Array<{ name: string }>).map((row) => row.name));
    for (const [name, sql] of DATA_MIGRATIONS) {
      if (applied.has(name)) continue;
      db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO research_migrations (name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
      })();
    }
  }
}
