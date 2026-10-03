import type { TargetListing, TargetListings } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** The Amazon listing found for each review-mining target, one row per stage-1 run and target. */
export class TargetListingTable implements TargetListings {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_target_listings (
    source_run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    target_id     TEXT NOT NULL,
    body          TEXT NOT NULL,
    fetched_at    TEXT NOT NULL,
    PRIMARY KEY (source_run_id, target_id)
);
`;

  constructor(private readonly db: SqlDatabase) {}

  async save(listing: TargetListing): Promise<void> {
    Trace.line(import.meta.url, "TargetListingTable.save", { sourceRunId: listing.source_run_id, targetId: listing.target_id });
    await this.db.run(
      "INSERT INTO research_target_listings (source_run_id, target_id, body, fetched_at) VALUES (?,?,?,?)" +
        " ON CONFLICT(source_run_id, target_id) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at",
      [listing.source_run_id, listing.target_id, JSON.stringify(listing), listing.fetched_at],
    );
  }

  async list(sourceRunId: string): Promise<TargetListing[]> {
    Trace.line(import.meta.url, "TargetListingTable.list", { sourceRunId });
    const rows = await this.db.all<{ body: string }>(
      "SELECT body FROM research_target_listings WHERE source_run_id = ? ORDER BY target_id",
      [sourceRunId],
    );
    return rows.map((row) => JSON.parse(row.body) as TargetListing);
  }
}
