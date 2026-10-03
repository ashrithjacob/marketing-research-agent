import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteDatabase, SqlResearchStore, StoreCopy, type SqlDatabase } from "../src/adapters/index.js";
import { Scope } from "../src/domain/index.js";

import { minimalPacket } from "./fixtures.js";
import { PostgresStores } from "./postgres-stores.js";

let dir: string;
let path: string;
let postgres: PostgresStores;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-copy-"));
  path = join(dir, "research.db");
  postgres = await PostgresStores.start();
}, 30_000);
afterEach(async () => {
  await postgres.stop();
  rmSync(dir, { recursive: true, force: true });
});

async function seeded(): Promise<{ from: SqlDatabase; runId: string }> {
  const from = SqliteDatabase.open(path);
  const store = await SqlResearchStore.open(from);
  const run = await store.createRun({ workspaceId: "admin", brief: { product: "Mullevia" }, model: "m", rejectKinds: [], judgementIds: [] });
  await store.updateRun(run.id, { status: "completed", packet: minimalPacket(), usage: { cost: 0.0123456789 } });
  for (const n of [1, 2, 3]) await store.addEvent(run.id, "tick", { n });
  await store.findings.append({ run_id: run.id, kind: "source", entity: "", agent_id: "product", source_id: "", payload: { url: "u" } });
  await store.charges.add({ run_id: run.id, agent_id: null, service: "apify", item: "x", units: 1, usd: 0.01, basis: "billed" });
  await store.accounts.seedAdmin("ash", "hash");
  return { from, runId: run.id };
}

describe("copying the SQLite store into Postgres", () => {
  it("copies every table, proves each row for row, and keeps numbering ids after the copied ones", async () => {
    const { from, runId } = await seeded();
    const copied = await new StoreCopy(from, postgres.db).copy();
    expect(copied.filter((table) => !table.matches)).toEqual([]);
    expect(copied.find((table) => table.table === "research_events")?.rows).toBe(3);
    const store = postgres.store;
    expect((await store.getRun(runId))?.usage).toEqual({ cost: 0.0123456789 });
    expect((await store.products.packetRows((await store.getRun(runId))!.product_id, Scope.everything)).attributes).toHaveLength(1);
    expect((await store.addEvent(runId, "after", {})).id).toBe(4);
    await from.close();
  });

  it("refuses a target that already holds runs", async () => {
    const { from } = await seeded();
    await postgres.store.createRun({ workspaceId: "admin", brief: { product: "x" }, model: "m", rejectKinds: [], judgementIds: [] });
    await expect(new StoreCopy(from, postgres.db).copy()).rejects.toThrow(/already holds runs/);
    await from.close();
  });

  it("names a retired table it leaves behind, and stops at one it does not know", async () => {
    const { from } = await seeded();
    await from.close();
    const raw = new Database(path);
    raw.exec("CREATE TABLE trendtrack_cache (key TEXT); INSERT INTO trendtrack_cache VALUES ('a'), ('b');");
    raw.close();
    const reopened = SqliteDatabase.open(path);
    expect(await new StoreCopy(reopened, postgres.db).leftBehind()).toEqual([{ table: "trendtrack_cache", rows: 2 }]);
    await reopened.exec("CREATE TABLE mystery (x TEXT)");
    await expect(new StoreCopy(reopened, postgres.db).leftBehind()).rejects.toThrow(/does not know: mystery/);
    await reopened.close();
  });
});
