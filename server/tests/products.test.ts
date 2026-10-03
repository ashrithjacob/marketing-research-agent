/** Products: which briefs share one, the run a product opens on, and the rows its runs found. */
import { Scope } from "../src/domain/index.js";

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/http/index.js";
import { RunSupervisor, StageOneHandoff } from "../src/agent/index.js";
import { Env } from "../src/config/index.js";
import { Briefs, ProductFolders, type Product, type RunHead } from "../src/domain/index.js";
import { SqlResearchStore } from "../src/adapters/index.js";

import { minimalPacket } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

describe("Briefs.key", () => {
  it("treats spellings of one typed name as one product", () => {
    const keys = ["vitamin D", "vitamin_d", "vitamin-d", "Vitamin-D", "VITAMIND"].map((product) =>
      Briefs.key({ product }),
    );
    expect(new Set(keys)).toEqual(new Set(["product:vitamind"]));
  });

  it("treats one page reached by different links as one product", () => {
    const keys = [
      "https://www.naturemade.com/products/d3",
      "http://naturemade.com/products/d3/",
      "https://WWW.NatureMade.com/Products/D3",
      "naturemade.com/products/d3?ref=ig",
      "https://naturemade.com/products/d3#reviews",
      "https://naturemade.com:443/products/d3",
    ].map((url) => Briefs.key({ url }));
    expect(new Set(keys)).toEqual(new Set(["page:naturemade.com/products/d3"]));
  });

  it("reads a url typed into the product field as that page", () => {
    expect(Briefs.key({ product: "https://thedropletco.co.uk/" })).toBe(
      Briefs.key({ product: "", url: "https://thedropletco.co.uk" }),
    );
  });

  it("keeps two pages on one site apart", () => {
    expect(Briefs.key({ url: "https://naturemade.com/products/d3" })).not.toBe(
      Briefs.key({ url: "https://naturemade.com/products/fish-oil" }),
    );
  });
});

describe("ProductFolders.summaries", () => {
  const product = (id: string): Product => ({
    id,
    key: `product:${id}`,
    label: id,
    review_count: 0,
    created_at: "2026-09-01T00:00:00Z",
  });
  const head = (id: string, product_id: string, status: string, at: string): RunHead => ({
    id,
    product_id,
    stage: 1,
    status,
    created_at: at,
  });

  it("opens on the newest completed run even when a newer one is running or failed", () => {
    const [summary] = ProductFolders.summaries(
      [product("d")],
      [
        head("old-done", "d", "completed", "2026-09-01T00:00:00Z"),
        head("new-done", "d", "completed", "2026-09-02T00:00:00Z"),
        head("failed", "d", "failed", "2026-09-03T00:00:00Z"),
        head("live", "d", "running", "2026-09-04T00:00:00Z"),
      ],
    );
    expect(summary).toMatchObject({ run_count: 4, latest_status: "running", default_run_id: "new-done" });
  });

  it("falls back to the newest run when none completed", () => {
    const [summary] = ProductFolders.summaries(
      [product("d")],
      [head("a", "d", "failed", "2026-09-01T00:00:00Z"), head("b", "d", "cancelled", "2026-09-02T00:00:00Z")],
    );
    expect(summary?.default_run_id).toBe("b");
  });

  it("lists the product with the newest run first", () => {
    const summaries = ProductFolders.summaries(
      [product("old"), product("new")],
      [head("a", "old", "completed", "2026-09-01T00:00:00Z"), head("b", "new", "completed", "2026-09-02T00:00:00Z")],
    );
    expect(summaries.map((s) => s.id)).toEqual(["new", "old"]);
  });
});

describe("the product store", () => {
  let dir: string;
  let store: SqlResearchStore;
  const path = () => join(dir, "research.db");
  const run = (product: string, stage = 1) =>
    store.createRun({ workspaceId: "admin", brief: { product, url: "", market: "", notes: "" }, model: "m", rejectKinds: [], judgementIds: [], stage });

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "mra-products-"));
    store = await SqliteStores.open(path());
  });

  afterEach(async () => {
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("files every spelling of a name under one stored product", async () => {
    const ids: string[] = [];
    for (const name of ["Vitamin D", "vitamin_d", "VITAMIND"]) ids.push((await run(name)).product_id);
    expect(new Set(ids).size).toBe(1);
    expect((await store.products.list(Scope.everything))).toHaveLength(1);
    expect((await store.products.get(ids[0]!, Scope.everything))?.label).toBe("VITAMIND");
  });

  it("stores a packet's facts as rows tagged with run and product, replacing them on rewrite", async () => {
    const first = (await run("MagnaCalm"));
    await store.updateRun(first.id, { packet: minimalPacket() });
    await store.updateRun(first.id, { packet: minimalPacket() });
    const rows = (await store.products.packetRows(first.product_id, Scope.everything));
    expect(rows.attributes).toEqual([expect.objectContaining({ key: "dose_per_serving", value: "400 mg", run_id: first.id })]);
    expect(rows.sources).toHaveLength(1);
    expect(rows.gaps).toHaveLength(1);
  });

  it("links each saved review to the run's product, counting a review two runs share once", async () => {
    const pull = { handle: "p1", source_id: "s", target_id: "product", platform: "amazon" as const, listing: "L", band_requested: 3, fetched_at: "", archived: true, total_reviews: null, total_ratings: null, gap: null };
    const review = { ref: "r1", pull: "p1", platform: "amazon" as const, review_key: "R1", listing: "L", star: 3, title: "t", text: "works", posted_at: "", verified: true, locator: "" };
    const [a, b] = [await run("Vitamin D", 2), await run("vitamin-d", 2)];
    for (const r of [a!, b!]) await store.saveRunReviews(r.id, { pulls: [pull], reviews: [review] });
    expect((await store.products.get(a!.product_id, Scope.everything))?.review_count).toBe(1);
  });

  it("gives runs from before products existed their product, rows and review links", async () => {
    const legacy = (await run("Vitamin D"));
    await store.updateRun(legacy.id, { packet: minimalPacket() });
    await store.close();
    const db = new Database(path());
    db.exec("UPDATE research_runs SET product_id = ''; DELETE FROM research_products; DELETE FROM research_packet_attributes;");
    db.close();

    store = await SqliteStores.open(path());
    const again = (await store.getRun(legacy.id))!;
    expect(again.product_id).not.toBe("");
    expect((await store.products.get(again.product_id, Scope.everything))?.key).toBe("product:vitamind");
    expect((await store.products.packetRows(again.product_id, Scope.everything)).attributes).toHaveLength(1);
  });
});

describe("products cover every run, not the newest page", () => {
  let dir: string;
  let store: SqlResearchStore;
  let app: App;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "mra-products-api-"));
    const settings = { ...Env.settings(), corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "" };
    store = await SqliteStores.open(join(dir, "research.db"));
    app = new App({ settings, store, supervisor: new RunSupervisor({ store, settings }) });
  });

  afterEach(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function seed(newer: number): Promise<{ id: string; product_id: string }> {
    const db = new Database(join(dir, "research.db"));
    const make = async (product: string, i: number) => {
      const created = (await store.createRun({ workspaceId: "admin", brief: { product, url: "", market: "", notes: "" }, model: "m", rejectKinds: [], judgementIds: [], stage: 1 }));
      const at = new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString();
      db.prepare("UPDATE research_runs SET created_at = ? WHERE id = ?").run(at, created.id);
      return created;
    };
    const oldest = (await make("Vitamin D", 0));
    for (let i = 1; i <= newer; i++) await make(`Filler ${i}`, i);
    db.close();
    return oldest;
  }

  const get = async (path: string) => (await (await app.fetch(new Request(`http://test${path}`))).json()) as Promise<any>;

  it("lists a product whose only run is older than the newest 50", async () => {
    const oldest = await seed(60);
    const products = (await get("/api/research/products")).data;
    expect(products).toHaveLength(61);
    expect(products.at(-1)).toMatchObject({ id: oldest.product_id, label: "Vitamin D", default_run_id: oldest.id });
    const runs = (await get(`/api/research/products/${oldest.product_id}/runs`)).data;
    expect(runs.map((r: any) => [r.id, r.product_id])).toEqual([[oldest.id, oldest.product_id]]);
    expect(await get(`/api/research/products/${oldest.product_id}`)).toMatchObject({ run_count: 1 });
  });

  it("hands stage 2 a stage-1 run older than the newest 200", async () => {
    const oldest = await seed(210);
    await store.updateRun(oldest.id, { status: "completed", packet: minimalPacket() });
    const found = (await new StageOneHandoff(store).forBrief({ product: "VITAMIN-D", url: "", market: "", notes: "" }, Scope.everything));
    expect(found?.run.id).toBe(oldest.id);
  });
});
