import type Database from "better-sqlite3";

import { AccountTable } from "./account-table.js";
import { CallLog } from "./call-log.js";
import { FindingTable } from "./finding-table.js";
import { PacketRowTable } from "./packet-row-table.js";
import { ReviewAnalysisTable } from "./review-analysis-table.js";
import { TargetListingTable } from "./target-listing-table.js";
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

/** CREATE TABLE IF NOT EXISTS never alters an existing table, so columns migrate here. */
export class SqliteSchema {
  static apply(db: Database.Database): void {
    Trace.line(import.meta.url, "SqliteSchema.apply", { db });
    db.exec(SqliteSchema.DDL);
    db.exec(AccountTable.DDL);
    db.exec(CallLog.DDL);
    for (const [table, column, ddl] of MIGRATIONS) {
      const have = (db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((row) => row.name);
      if (!have.includes(column)) db.exec(ddl);
    }
    db.exec(SqliteSchema.INDEXES);
    for (const ddl of [PacketRowTable.DDL, ReviewAnalysisTable.DDL, TargetListingTable.DDL, FindingTable.DDL]) db.exec(ddl);
  }

  static readonly INDEXES = `
CREATE INDEX IF NOT EXISTS research_runs_product ON research_runs(product_id);
CREATE INDEX IF NOT EXISTS research_run_reviews_product ON research_run_reviews(product_id);
CREATE INDEX IF NOT EXISTS research_runs_workspace ON research_runs(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS research_judgements_workspace ON research_judgements(workspace_id);
`;

  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_runs (
    id             TEXT PRIMARY KEY,
    agent_run_id   TEXT NOT NULL DEFAULT '',
    session_id     TEXT NOT NULL DEFAULT '',
    stage          INTEGER NOT NULL DEFAULT 1,
    status         TEXT NOT NULL,
    model          TEXT NOT NULL DEFAULT '',
    brief          TEXT NOT NULL DEFAULT '{}',
    reject_kinds   TEXT NOT NULL DEFAULT '[]',
    judgement_ids  TEXT NOT NULL DEFAULT '[]',
    nodes          TEXT NOT NULL DEFAULT '[]',
    packet         TEXT NOT NULL DEFAULT '',
    error          TEXT NOT NULL DEFAULT '',
    output         TEXT NOT NULL DEFAULT '',
    usage          TEXT NOT NULL DEFAULT '{}',
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    ended_at       TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS research_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id     TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    payload    TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_events_run
    ON research_events(run_id, id);
CREATE TABLE IF NOT EXISTS research_packet_checks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id     TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    seq        INTEGER NOT NULL,
    valid      INTEGER NOT NULL,
    problems   TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_packet_checks_run
    ON research_packet_checks(run_id, seq);
CREATE TABLE IF NOT EXISTS research_judgements (
    id            TEXT PRIMARY KEY,
    kind          TEXT NOT NULL,
    text          TEXT NOT NULL,
    rejects_kinds TEXT NOT NULL DEFAULT '[]',
    active        INTEGER NOT NULL DEFAULT 1,
    applied_count INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS research_reviews (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    platform      TEXT NOT NULL,
    review_key    TEXT NOT NULL,
    listing       TEXT NOT NULL DEFAULT '',
    star          INTEGER,
    title         TEXT NOT NULL DEFAULT '',
    text          TEXT NOT NULL,
    posted_at     TEXT NOT NULL DEFAULT '',
    verified      INTEGER NOT NULL DEFAULT 0,
    locator       TEXT NOT NULL DEFAULT '',
    first_seen_at TEXT NOT NULL,
    last_seen_at  TEXT NOT NULL,
    UNIQUE(platform, review_key)
);
CREATE TABLE IF NOT EXISTS research_run_reviews (
    run_id         TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    review_id      INTEGER NOT NULL REFERENCES research_reviews(id),
    ref            TEXT NOT NULL,
    target_id      TEXT NOT NULL DEFAULT '',
    source_id      TEXT NOT NULL DEFAULT '',
    band_requested INTEGER,
    PRIMARY KEY (run_id, review_id)
);
CREATE TABLE IF NOT EXISTS research_products (
    id         TEXT PRIMARY KEY,
    key        TEXT NOT NULL UNIQUE,
    label      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
`;
}
