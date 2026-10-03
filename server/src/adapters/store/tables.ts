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
import { SqlProductCatalog } from "./product-catalog.js";
import { ProductTable } from "./product-table.js";
import { ReviewPullTable } from "./review-pull-table.js";
import { ReviewAnalysisTable } from "./review-analysis-table.js";
import { ReviewTable } from "./review-table.js";
import { RunTable } from "./run-table.js";
import { StoreSchema } from "./schema.js";
import type { SqlDatabase } from "./sql-database.js";
import { TargetListingTable } from "./target-listing-table.js";

/** One object per table, on a database whose schema is applied. */
export class StoreTables {
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

  private constructor(readonly db: SqlDatabase) {
    Trace.line(import.meta.url, "StoreTables.constructor");
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
    this.catalog = new SqlProductCatalog(this.products, this.runs, this.packetRows);
  }

  /** Applies the schema and its migrations, then backfills runs from before products existed. */
  static async open(db: SqlDatabase): Promise<StoreTables> {
    Trace.line(import.meta.url, "StoreTables.open");
    await StoreSchema.apply(db);
    const tables = new StoreTables(db);
    await new ProductBackfill(db, tables.products, tables.packetRows).apply();
    return tables;
  }
}
