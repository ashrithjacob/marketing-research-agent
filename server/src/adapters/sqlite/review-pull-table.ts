import type Database from "better-sqlite3";

import { Clock, type ReviewPlatform, type ReviewPullStore, type ReviewResult, type StoredPull } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { Rows } from "./rows.js";

/** Every pull's answer from the review service, kept so the same listing and star band is paid for once; shared by every workspace. A new table, so no older database needs altering. */
export class ReviewPullTable implements ReviewPullStore {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_review_pulls (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    platform  TEXT NOT NULL,
    listing   TEXT NOT NULL,
    band      INTEGER,
    pulled_at TEXT NOT NULL,
    result    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS research_review_pulls_listing ON research_review_pulls(platform, listing, band, pulled_at);
`;

  constructor(private readonly db: Database.Database) {}

  latest(platform: ReviewPlatform, listing: string, band: number | null, since: string): StoredPull | null {
    Trace.line(import.meta.url, "ReviewPullTable.latest", { platform, listing, band, since });
    const row = this.db
      .prepare("SELECT pulled_at, result FROM research_review_pulls WHERE platform = ? AND listing = ? AND band IS ? AND pulled_at >= ? ORDER BY pulled_at DESC LIMIT 1")
      .get(platform, listing, band, since) as { pulled_at: string; result: string } | undefined;
    return row ? { pulled_at: row.pulled_at, result: Rows.json(row.result, null) as ReviewResult } : null;
  }

  save(platform: ReviewPlatform, listing: string, band: number | null, result: ReviewResult): void {
    Trace.line(import.meta.url, "ReviewPullTable.save", { platform, listing, band, reviews: result.excerpts.length });
    this.db
      .prepare("INSERT INTO research_review_pulls (platform, listing, band, pulled_at, result) VALUES (?,?,?,?,?)")
      .run(platform, listing, band, Clock.nowIso(), JSON.stringify(result));
  }
}
