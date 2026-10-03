import type { Settings } from "../../config/index.js";
import { Trace } from "../../trace/index.js";

import { PostgresDatabase } from "./postgres-database.js";
import type { SqlDatabase } from "./sql-database.js";
import { SqliteDatabase } from "./sqlite-database.js";

/** The database the settings name: Postgres when DATABASE_URL is set, otherwise the SQLite file. */
export class StoreDatabase {
  static forSettings(settings: Settings): SqlDatabase {
    Trace.line(import.meta.url, "StoreDatabase.forSettings", { postgres: settings.databaseUrl !== "" });
    if (settings.databaseUrl) return PostgresDatabase.connect(settings.databaseUrl, settings.databaseConnections);
    return SqliteDatabase.open(settings.databasePath);
  }
}
