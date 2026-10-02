import type Database from "better-sqlite3";

import { Clock, type Charge, type ChargeLedger } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** What each run paid for, one row per paid call, tagged with the agent whose tool made it; a new table, so no older database needs altering. */
export class ChargeTable implements ChargeLedger {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_charges (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id     TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    agent_id   TEXT,
    service    TEXT NOT NULL,
    item       TEXT NOT NULL DEFAULT '',
    units      REAL NOT NULL DEFAULT 0,
    usd        REAL,
    basis      TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS research_charges_run ON research_charges(run_id);
`;

  constructor(private readonly db: Database.Database) {}

  add(charge: Omit<Charge, "created_at">): Charge {
    Trace.line(import.meta.url, "ChargeTable.add", { runId: charge.run_id, agentId: charge.agent_id, service: charge.service });
    const created_at = Clock.nowIso();
    this.db
      .prepare("INSERT INTO research_charges (run_id, agent_id, service, item, units, usd, basis, created_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(charge.run_id, charge.agent_id, charge.service, charge.item, charge.units, charge.usd, charge.basis, created_at);
    return { ...charge, created_at };
  }

  list(runId: string): Charge[] {
    Trace.line(import.meta.url, "ChargeTable.list", { runId });
    const rows = this.db.prepare("SELECT * FROM research_charges WHERE run_id = ? ORDER BY id").all(runId) as Array<Record<string, any>>;
    return rows.map((row) => ({
      run_id: row.run_id,
      agent_id: row.agent_id ?? null,
      service: row.service,
      item: row.item,
      units: row.units,
      usd: row.usd ?? null,
      basis: row.basis,
      created_at: row.created_at,
    }));
  }
}
