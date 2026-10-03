import type Database from "better-sqlite3";

import { AccountTable } from "./account-table.js";
import { CallLog } from "./call-log.js";
import { ChargeTable } from "./charge-table.js";
import { CompetitorKinds } from "./competitor-kinds.js";
import { FindingTable } from "./finding-table.js";
import { SqliteMigrations } from "./migrations.js";
import { PacketRowTable } from "./packet-row-table.js";
import { ReviewPullTable } from "./review-pull-table.js";
import { ReviewAnalysisTable } from "./review-analysis-table.js";
import { TargetListingTable } from "./target-listing-table.js";
import { Trace } from "../../trace/index.js";

/** The tables, then their migrations, then the indexes that need the migrated columns, then the row migrations that need every table. */
export class SqliteSchema {
  static apply(db: Database.Database): void {
    Trace.line(import.meta.url, "SqliteSchema.apply", { db });
    db.exec(SqliteSchema.DDL);
    db.exec(AccountTable.DDL);
    db.exec(CallLog.DDL);
    SqliteMigrations.apply(db);
    db.exec(SqliteSchema.INDEXES);
    for (const ddl of [PacketRowTable.DDL, ReviewAnalysisTable.DDL, TargetListingTable.DDL, FindingTable.DDL, ChargeTable.DDL, ReviewPullTable.DDL]) db.exec(ddl);
    SqliteMigrations.once(db, CompetitorKinds.NAME, () => new CompetitorKinds(db).apply());
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
