/** The store: the schema arrives by numbered migrations applied once each, products are one row per account and url, and confirming competitors keeps earlier ones as proposals. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Migrator } from "../src/adapters/store/migrator.js";
import { ADMIN_ACCOUNT, Scope, Stages } from "../src/domain/index.js";

import { PostgresStores } from "./postgres-stores.js";

let pg: PostgresStores;

beforeAll(async () => {
  pg = await PostgresStores.start();
});

afterAll(async () => {
  await pg.stop();
});

describe("migrations", () => {
  it("apply once: a second start changes nothing, and the spec's tables with their vector columns exist", async () => {
    expect(await new Migrator(pg.db).migrate()).toEqual([]);
    const tables = (await pg.db.all<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).map((r) => r.table_name);
    for (const table of ["accounts", "products", "competitors", "reviews", "review_signals", "ads", "ad_extractions", "avatars", "gaps", "generated_ads", "outcomes", "patterns", "product_images", "label_facts"]) {
      expect(tables).toContain(table);
    }
    expect(await pg.db.get("SELECT name FROM accounts WHERE id = ?", [ADMIN_ACCOUNT])).toEqual({ name: "admin" });
  });
});

describe("an applied migration", () => {
  it("refuses to start once it has been edited, and applies a new one appended after it", async () => {
    const first = { id: 1001, name: "probe", sql: "CREATE TABLE probe (id INTEGER)" };
    expect(await new Migrator(pg.db, [first]).migrate()).toEqual([1001]);
    await expect(new Migrator(pg.db, [{ ...first, sql: "CREATE TABLE probe (id BIGINT)" }]).migrate()).rejects.toThrow(
      "migration 1001 (probe) was edited after it was applied; restore it and add a new migration instead",
    );
    const next = { id: 1002, name: "probe_column", sql: "ALTER TABLE probe ADD COLUMN note TEXT" };
    expect(await new Migrator(pg.db, [first, next]).migrate()).toEqual([1002]);
  });
});

describe("products and competitors", () => {
  it("keep one product row per account and url, and a reconfirmation demotes competitors left out", async () => {
    const { store } = pg;
    const client = await store.accounts.addAccount("store-test");
    const first = await store.products.upsert(client.id, "https://x.example/p", "X");
    const again = await store.products.upsert(client.id, "https://x.example/p", "X");
    expect(again.id).toBe(first.id);
    expect((await store.products.upsert(ADMIN_ACCOUNT, "https://x.example/p", "X")).id).not.toBe(first.id);

    const a = { brand: "A", product_name: "A drops", url: "https://www.a.example/p" };
    const b = { brand: "B", product_name: "B drops", url: "https://b.example/p" };
    expect((await store.competitors.confirm(first, [a, b])).map((c) => [c.brand, c.domain])).toEqual([["A", "a.example"], ["B", "b.example"]]);
    expect((await store.competitors.confirm(first, [b])).map((c) => c.brand)).toEqual(["B"]);
    expect((await store.competitors.list(first.id)).map((c) => [c.brand, c.status])).toEqual([["A", "proposed"], ["B", "confirmed"]]);
  });

  it("list runs only for the account a scope admits", async () => {
    const { store } = pg;
    const other = await store.accounts.addAccount("other-client");
    const input = { product_url: "https://x.example/p", product_name: null, markets: ["US" as const], known_competitors: [], brand_constraints: "", price_offer: "" };
    const mine = await store.runs.create({ accountId: other.id, input, model: "m", stages: Stages.initial([]) });
    expect((await store.runs.list(Scope.of(other.id))).map((r) => r.id)).toEqual([mine.id]);
    expect((await store.runs.list(Scope.of(ADMIN_ACCOUNT))).map((r) => r.id)).not.toContain(mine.id);
    expect((await store.runs.list(Scope.everything)).map((r) => r.id)).toContain(mine.id);
  });
});
