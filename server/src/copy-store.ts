import { PostgresDatabase, SqliteDatabase, SqlResearchStore, StoreCopy } from "./adapters/index.js";
import { Env } from "./config/index.js";

const [path] = process.argv.slice(2);
const settings = Env.settings();
if (!path || !settings.databaseUrl) {
  console.error("usage: DATABASE_URL=postgres://… npm run copy-store -- <research.db>   (copies a SQLite file into an empty Postgres)");
  process.exit(2);
}
const from = SqliteDatabase.open(path);
const to = PostgresDatabase.connect(settings.databaseUrl, 1);
await SqlResearchStore.open(from);
await SqlResearchStore.open(to);
const copy = new StoreCopy(from, to);
for (const { table, rows } of await copy.leftBehind()) console.log(`left behind (retired)  ${table}: ${rows} rows`);
const copied = await copy.copy();
for (const { table, rows, matches } of copied) console.log(`${matches ? "match   " : "MISMATCH"}  ${table.padEnd(30)} ${rows}`);
await from.close();
await to.close();
process.exit(copied.every((table) => table.matches) ? 0 : 1);
