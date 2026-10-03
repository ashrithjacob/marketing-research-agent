import { Trace } from "../../trace/index.js";

import { Rows } from "./rows.js";
import type { SqlDatabase } from "./sql-database.js";

const MIGRATIONS: ReadonlyArray<readonly [string, string, string]> = [
  ["research_runs", "output", "ALTER TABLE research_runs ADD COLUMN output TEXT NOT NULL DEFAULT ''"],
  ["research_runs", "judgement_ids", "ALTER TABLE research_runs ADD COLUMN judgement_ids TEXT NOT NULL DEFAULT '[]'"],
  ["research_runs", "usage", "ALTER TABLE research_runs ADD COLUMN usage TEXT NOT NULL DEFAULT '{}'"],
  ["research_runs", "agent_run_id", "ALTER TABLE research_runs ADD COLUMN agent_run_id TEXT NOT NULL DEFAULT ''"],
  ["research_runs", "nodes", "ALTER TABLE research_runs ADD COLUMN nodes TEXT NOT NULL DEFAULT '[]'"],
  ["research_runs", "packet_source", "ALTER TABLE research_runs ADD COLUMN packet_source TEXT NOT NULL DEFAULT ''"],
  ["research_runs", "product_id", "ALTER TABLE research_runs ADD COLUMN product_id TEXT NOT NULL DEFAULT ''"],
  ["research_run_reviews", "product_id", "ALTER TABLE research_run_reviews ADD COLUMN product_id TEXT NOT NULL DEFAULT ''"],
  ["research_run_reviews", "seq", "ALTER TABLE research_run_reviews ADD COLUMN seq INTEGER NOT NULL DEFAULT 0; UPDATE research_run_reviews SET seq = rowid"],
  ["research_runs", "workspace_id", "ALTER TABLE research_runs ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'admin'"],
  ["research_judgements", "workspace_id", "ALTER TABLE research_judgements ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'admin'"],
  ["research_llm_calls", "generation", "ALTER TABLE research_llm_calls ADD COLUMN generation TEXT"],
  ["research_review_pulls", "requested", "ALTER TABLE research_review_pulls ADD COLUMN requested INTEGER"],
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

/** CREATE TABLE IF NOT EXISTS never alters an existing table, so columns migrate here, and a table not yet created gets them from its own DDL; a change to rows already stored runs once, by name. */
export class StoreMigrations {
  static async apply(db: SqlDatabase): Promise<void> {
    Trace.line(import.meta.url, "StoreMigrations.apply");
    for (const [table, column, ddl] of MIGRATIONS) {
      const columns = await db.columns(table);
      if (columns.length > 0 && !columns.includes(column)) await db.exec(ddl);
    }
    await StoreMigrations.once(db, "review-mining-is-stage-3", StoreMigrations.reviewMiningIsStageThree);
  }

  /** Runs `change` and records it under `name`, in one transaction, unless a migration of that name has run. */
  static async once(db: SqlDatabase, name: string, change: (tx: SqlDatabase) => Promise<void>): Promise<void> {
    Trace.line(import.meta.url, "StoreMigrations.once", { name });
    await db.exec("CREATE TABLE IF NOT EXISTS research_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    if (await db.get("SELECT 1 AS done FROM research_migrations WHERE name = ?", [name])) return;
    await db.transaction(async (tx) => {
      await change(tx);
      await tx.run("INSERT INTO research_migrations (name, applied_at) VALUES (?, ?)", [name, new Date().toISOString()]);
    });
  }

  private static async reviewMiningIsStageThree(tx: SqlDatabase): Promise<void> {
    Trace.line(import.meta.url, "StoreMigrations.reviewMiningIsStageThree");
    const runs = await tx.all<{ id: string; packet: string }>("SELECT id, packet FROM research_runs WHERE stage = 2");
    for (const run of runs) {
      const packet = Rows.json(run.packet, null) as Record<string, unknown> | null;
      const rewritten = packet && typeof packet === "object" ? JSON.stringify({ ...packet, stage: 3 }) : run.packet;
      await tx.run("UPDATE research_runs SET stage = 3, packet = ? WHERE id = ?", [rewritten, run.id]);
    }
  }
}
