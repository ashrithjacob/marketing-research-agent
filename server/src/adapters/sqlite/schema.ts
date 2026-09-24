import type Database from "better-sqlite3";

import { SqliteReviewLedger } from "./review-ledger.js";

const MIGRATIONS: ReadonlyArray<readonly [string, string]> = [
  ["output", "ALTER TABLE research_runs ADD COLUMN output TEXT NOT NULL DEFAULT ''"],
  ["judgement_ids", "ALTER TABLE research_runs ADD COLUMN judgement_ids TEXT NOT NULL DEFAULT '[]'"],
  ["usage", "ALTER TABLE research_runs ADD COLUMN usage TEXT NOT NULL DEFAULT '{}'"],
  ["agent_run_id", "ALTER TABLE research_runs ADD COLUMN agent_run_id TEXT NOT NULL DEFAULT ''"],
  ["nodes", "ALTER TABLE research_runs ADD COLUMN nodes TEXT NOT NULL DEFAULT '[]'"],
  ["packet_source", "ALTER TABLE research_runs ADD COLUMN packet_source TEXT NOT NULL DEFAULT ''"],
];

/** CREATE TABLE IF NOT EXISTS never alters an existing table, so columns migrate here. */
export class SqliteSchema {
  static apply(db: Database.Database): void {
    db.exec(SqliteSchema.DDL);
    db.exec(SqliteReviewLedger.DDL);
    const have = new Set(
      (db.pragma("table_info(research_runs)") as Array<{ name: string }>).map((row) => row.name),
    );
    for (const [column, ddl] of MIGRATIONS) {
      if (!have.has(column)) db.exec(ddl);
    }
  }

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
CREATE TABLE IF NOT EXISTS research_llm_calls (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id           TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    seq              INTEGER NOT NULL,
    started_at       TEXT NOT NULL,
    ended_at         TEXT NOT NULL,
    duration_ms      INTEGER NOT NULL,
    model            TEXT NOT NULL DEFAULT '',
    system_prompt    TEXT,
    tools            TEXT,
    context_reset    INTEGER NOT NULL DEFAULT 0,
    context_messages INTEGER NOT NULL DEFAULT 0,
    input            TEXT NOT NULL DEFAULT '[]',
    output           TEXT NOT NULL DEFAULT '{}',
    stop_reason      TEXT NOT NULL DEFAULT '',
    error            TEXT NOT NULL DEFAULT '',
    usage            TEXT NOT NULL DEFAULT '{}',
    response_id      TEXT NOT NULL DEFAULT '',
    billed_cost      REAL
);
CREATE INDEX IF NOT EXISTS idx_research_llm_calls_run
    ON research_llm_calls(run_id, seq);
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
`;;
}
