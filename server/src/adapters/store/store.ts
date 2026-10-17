import type { ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { AccountTable } from "./account-table.js";
import { CallTable } from "./call-table.js";
import { ChargeTable } from "./charge-table.js";
import { CompetitorTable } from "./competitor-table.js";
import { EventTable } from "./event-table.js";
import { Migrator } from "./migrator.js";
import { ProductTable } from "./product-table.js";
import { RunTable } from "./run-table.js";
import type { SqlDatabase } from "./sql-database.js";

/** Every table, on one Postgres database brought to the newest schema before anything reads it. */
export class SqlResearchStore implements ResearchStore {
  readonly accounts: AccountTable;
  readonly runs: RunTable;
  readonly products: ProductTable;
  readonly competitors: CompetitorTable;
  readonly events: EventTable;
  readonly charges: ChargeTable;
  readonly calls: CallTable;

  private constructor(private readonly db: SqlDatabase) {
    Trace.line(import.meta.url, "SqlResearchStore.constructor");
    this.accounts = new AccountTable(db);
    this.runs = new RunTable(db);
    this.products = new ProductTable(db);
    this.competitors = new CompetitorTable(db);
    this.events = new EventTable(db);
    this.charges = new ChargeTable(db);
    this.calls = new CallTable(db);
  }

  static async open(db: SqlDatabase): Promise<SqlResearchStore> {
    Trace.line(import.meta.url, "SqlResearchStore.open");
    await new Migrator(db).migrate();
    return new SqlResearchStore(db);
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "SqlResearchStore.close");
    await this.db.close();
  }
}
