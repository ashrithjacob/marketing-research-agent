import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import type { AccountDirectory, ChargeLedger, FindingLedger, ProductCatalog, ReviewPullStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { AccountTable } from "./account-table.js";
import { CallLog } from "./call-log.js";
import { ChargeTable } from "./charge-table.js";
import { PacketCheckLog } from "./check-log.js";
import { EventLog } from "./event-log.js";
import { FindingTable } from "./finding-table.js";
import { JudgementTable } from "./judgement-table.js";
import { PacketRowTable } from "./packet-row-table.js";
import { ProductBackfill } from "./product-backfill.js";
import { SqliteProductCatalog } from "./product-catalog.js";
import { ProductTable } from "./product-table.js";
import { ReviewPullTable } from "./review-pull-table.js";
import { ReviewAnalysisTable } from "./review-analysis-table.js";
import { ReviewTable } from "./review-table.js";
import { RunTable } from "./run-table.js";
import { TargetListingTable } from "./target-listing-table.js";
import { SqliteSchema } from "./schema.js";

/** Opens the database, applies the schema, and holds one object per table. */
export class SqliteTables {
  readonly runs: RunTable;
  readonly events: EventLog;
  readonly judgements: JudgementTable;
  readonly checks: PacketCheckLog;
  readonly calls: CallLog;
  readonly reviews: ReviewTable;
  readonly analyses: ReviewAnalysisTable;
  readonly listings: TargetListingTable;
  readonly products: ProductTable;
  readonly packetRows: PacketRowTable;
  readonly accounts: AccountDirectory;
  readonly catalog: ProductCatalog;
  readonly findings: FindingLedger;
  readonly charges: ChargeLedger;
  readonly pulls: ReviewPullStore;

  constructor(readonly db: Database.Database) {
    Trace.line(import.meta.url, "SqliteTables.constructor");
    this.runs = new RunTable(db);
    this.events = new EventLog(db);
    this.judgements = new JudgementTable(db);
    this.checks = new PacketCheckLog(db);
    this.calls = new CallLog(db);
    this.reviews = new ReviewTable(db);
    this.analyses = new ReviewAnalysisTable(db);
    this.listings = new TargetListingTable(db);
    this.products = new ProductTable(db);
    this.packetRows = new PacketRowTable(db);
    this.accounts = new AccountTable(db);
    this.findings = new FindingTable(db);
    this.charges = new ChargeTable(db);
    this.pulls = new ReviewPullTable(db);
    this.catalog = new SqliteProductCatalog(this.products, this.runs, this.packetRows);
    new ProductBackfill(db, this.products, this.packetRows).apply();
  }

  static open(path: string): SqliteTables {
    Trace.line(import.meta.url, "SqliteTables.open", { path });
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path, { timeout: 15000 });
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 15000");
    db.pragma("foreign_keys = ON");
    SqliteSchema.apply(db);
    return new SqliteTables(db);
  }
}
