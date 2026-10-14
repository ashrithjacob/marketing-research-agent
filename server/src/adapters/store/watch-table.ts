import { Clock, Ids, type ChargeDraft, type WatchBook, type WatchedBrand, type WorkspaceCharge } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** What the watchers keep: the competitors to watch, when each watcher last did a thing, and what they spent outside any run. */
export class WatchTable implements WatchBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_watched_brands (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    term         TEXT NOT NULL,
    search_in    TEXT NOT NULL,
    checked_at   TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS research_watch_marks (
    workspace_id TEXT NOT NULL,
    key          TEXT NOT NULL,
    at           TEXT NOT NULL,
    PRIMARY KEY (workspace_id, key)
);
CREATE TABLE IF NOT EXISTS research_workspace_charges (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    source       TEXT NOT NULL,
    service      TEXT NOT NULL,
    item         TEXT NOT NULL,
    units        REAL NOT NULL,
    usd          REAL,
    basis        TEXT NOT NULL,
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS research_workspace_charges_day ON research_workspace_charges(workspace_id, created_at);
`;

  constructor(private readonly db: SqlDatabase) {}

  brands(workspaceId: string): Promise<WatchedBrand[]> {
    Trace.line(import.meta.url, "WatchTable.brands", { workspaceId });
    return this.db.all<WatchedBrand>("SELECT * FROM research_watched_brands WHERE workspace_id = ? ORDER BY created_at", [workspaceId]);
  }

  async addBrand(workspaceId: string, term: string, searchIn: WatchedBrand["search_in"]): Promise<WatchedBrand> {
    Trace.line(import.meta.url, "WatchTable.addBrand", { workspaceId, searchIn });
    const brand: WatchedBrand = { id: Ids.next(), workspace_id: workspaceId, term, search_in: searchIn, checked_at: "", created_at: Clock.nowIso() };
    await this.db.run("INSERT INTO research_watched_brands (id, workspace_id, term, search_in, checked_at, created_at) VALUES (?,?,?,?,?,?)", [brand.id, workspaceId, term, searchIn, "", brand.created_at]);
    return brand;
  }

  async removeBrand(workspaceId: string, id: string): Promise<void> {
    Trace.line(import.meta.url, "WatchTable.removeBrand", { workspaceId, id });
    await this.db.run("DELETE FROM research_watched_brands WHERE workspace_id = ? AND id = ?", [workspaceId, id]);
  }

  async checked(id: string, at: string): Promise<void> {
    Trace.line(import.meta.url, "WatchTable.checked", { id });
    await this.db.run("UPDATE research_watched_brands SET checked_at = ? WHERE id = ?", [at, id]);
  }

  async mark(workspaceId: string, key: string): Promise<string> {
    Trace.line(import.meta.url, "WatchTable.mark", { workspaceId, key });
    return (await this.db.get<{ at: string }>("SELECT at FROM research_watch_marks WHERE workspace_id = ? AND key = ?", [workspaceId, key]))?.at ?? "";
  }

  async setMark(workspaceId: string, key: string, at: string): Promise<void> {
    Trace.line(import.meta.url, "WatchTable.setMark", { workspaceId, key });
    await this.db.run("DELETE FROM research_watch_marks WHERE workspace_id = ? AND key = ?", [workspaceId, key]);
    await this.db.run("INSERT INTO research_watch_marks (workspace_id, key, at) VALUES (?,?,?)", [workspaceId, key, at]);
  }

  async charge(workspaceId: string, source: string, charge: ChargeDraft): Promise<void> {
    Trace.line(import.meta.url, "WatchTable.charge", { workspaceId, source, service: charge.service });
    await this.db.run(
      "INSERT INTO research_workspace_charges (workspace_id, source, service, item, units, usd, basis, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [workspaceId, source, charge.service, charge.item, charge.units, charge.usd, charge.basis, Clock.nowIso()],
    );
  }

  async charges(workspaceId: string, since: string): Promise<WorkspaceCharge[]> {
    Trace.line(import.meta.url, "WatchTable.charges", { workspaceId, since });
    const rows = await this.db.all<WorkspaceCharge & { id: number }>("SELECT * FROM research_workspace_charges WHERE workspace_id = ? AND created_at >= ? ORDER BY id", [workspaceId, since]);
    return rows.map(({ id: _id, ...charge }) => charge);
  }
}
