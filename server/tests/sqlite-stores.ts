import { SqliteDatabase, SqlResearchStore } from "../src/adapters/index.js";

/** The research store on a SQLite file, as the tests open it. */
export class SqliteStores {
  static open(path: string): Promise<SqlResearchStore> {
    return SqlResearchStore.open(SqliteDatabase.open(path));
  }
}
