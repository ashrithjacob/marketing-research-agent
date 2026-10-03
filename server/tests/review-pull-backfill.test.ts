/**
 * Pulls were kept for reuse only from 2026-10-03. The reviews mined before then
 * were stored but invisible to reuse, so a new run paid Apify for them again.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ReviewPullBackfill } from "../src/adapters/store/review-pull-backfill.js";
import type { ReviewLedgerSnapshot } from "../src/domain/index.js";

import { SqliteStores } from "./sqlite-stores.js";

let dir: string;
let path: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-pull-backfill-"));
  path = join(dir, "research.db");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const AMAZON = "https://www.amazon.com/dp/B0CKBPTPRL";

const ledger = (band: number | null, platform: "amazon" | "trustpilot", listing: string, keys: string[]): ReviewLedgerSnapshot => ({
  pulls: [{ handle: "p1", source_id: "s", target_id: "c3", platform, listing, band_requested: band, fetched_at: "", archived: true, total_reviews: null, total_ratings: null, gap: null }],
  reviews: keys.map((key, i) => ({ ref: `r${i}`, pull: "p1", platform, review_key: key, listing, star: band, title: "t", text: `review ${key}`, posted_at: "2026-09-01", verified: true, locator: `loc-${key}` })),
});

describe("reviews stored before pulls were kept", () => {
  it("become kept pulls per listing and star band, which a later run finds and reuses", async () => {
    const store = await SqliteStores.open(path);
    const run = await store.createRun({ workspaceId: "admin", brief: { product: "Mullevia" }, model: "m", rejectKinds: [], judgementIds: [], stage: 3 });
    await store.saveRunReviews(run.id, ledger(3, "amazon", AMAZON, ["R1", "R2"]));
    const other = await store.createRun({ workspaceId: "client-b", brief: { product: "Mullevia" }, model: "m", rejectKinds: [], judgementIds: [], stage: 3 });
    await store.saveRunReviews(other.id, ledger(null, "trustpilot", "nutratea.co.uk", ["T1"]));
    await store.pulls.save("amazon", AMAZON, 5, { status: "SUCCEEDED", excerpts: [], gap: "kept already", offBand: 0, totalReviews: null, totalRatings: null });
    await store.close();
    const raw = new Database(path);
    raw.prepare("DELETE FROM research_migrations WHERE name = ?").run(ReviewPullBackfill.NAME);
    raw.close();

    const reopened = await SqliteStores.open(path);
    const kept = await reopened.pulls.latest("amazon", AMAZON, 3, "2000");
    expect(kept?.result.excerpts.map((e) => [e.reviewKey, e.star, e.verified, e.source])).toEqual([["R1", 3, true, "amazon"], ["R2", 3, true, "amazon"]]);
    expect(kept?.result.status).toBe("SUCCEEDED");
    expect((await reopened.pulls.latest("trustpilot", "nutratea.co.uk", null, "2000"))?.result.excerpts).toHaveLength(1);
    expect(await reopened.pulls.latest("amazon", AMAZON, 4, "2000")).toBeNull();
    expect((await reopened.pulls.latest("amazon", AMAZON, 5, "2000"))?.result.gap).toBe("kept already");
    await reopened.close();
  });
});
