import { Clock, type AdAccount, type AdBook, type AdInsight, type AdLink, type AdResult } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

type ResultRow = Omit<AdResult, "settled"> & { settled: number };

/** Each workspace's Meta ad accounts, the ad results read from them one row per ad per day, and which ad each draft became. */
export class AdTable implements AdBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_ad_accounts (
    workspace_id TEXT NOT NULL,
    account_id   TEXT NOT NULL,
    status       TEXT NOT NULL,
    error        TEXT NOT NULL DEFAULT '',
    connected_at TEXT NOT NULL,
    read_at      TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (workspace_id, account_id)
);
CREATE TABLE IF NOT EXISTS research_ad_results (
    workspace_id   TEXT NOT NULL,
    account_id     TEXT NOT NULL,
    ad_id          TEXT NOT NULL,
    ad_name        TEXT NOT NULL,
    date           TEXT NOT NULL,
    spend          REAL NOT NULL,
    impressions    REAL NOT NULL,
    clicks         REAL NOT NULL,
    purchases      REAL NOT NULL,
    purchase_value REAL NOT NULL,
    settled        INTEGER NOT NULL,
    read_at        TEXT NOT NULL,
    PRIMARY KEY (workspace_id, ad_id, date)
);
CREATE TABLE IF NOT EXISTS research_ad_links (
    workspace_id TEXT NOT NULL,
    draft_id     TEXT NOT NULL,
    ad_id        TEXT NOT NULL,
    by           TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    outcome_at   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (workspace_id, draft_id, ad_id)
);
`;

  constructor(private readonly db: SqlDatabase) {}

  accounts(workspaceId: string): Promise<AdAccount[]> {
    Trace.line(import.meta.url, "AdTable.accounts", { workspaceId });
    return this.db.all<AdAccount>("SELECT * FROM research_ad_accounts WHERE workspace_id = ? ORDER BY connected_at", [workspaceId]);
  }

  async connect(workspaceId: string, accountId: string): Promise<AdAccount> {
    Trace.line(import.meta.url, "AdTable.connect", { workspaceId, accountId });
    const account: AdAccount = { workspace_id: workspaceId, account_id: accountId, status: "connected", error: "", connected_at: Clock.nowIso(), read_at: "" };
    await this.db.run("DELETE FROM research_ad_accounts WHERE workspace_id = ? AND account_id = ?", [workspaceId, accountId]);
    await this.db.run("INSERT INTO research_ad_accounts (workspace_id, account_id, status, error, connected_at, read_at) VALUES (?,?,?,?,?,?)", [workspaceId, accountId, "connected", "", account.connected_at, ""]);
    return account;
  }

  async disconnect(workspaceId: string, accountId: string): Promise<void> {
    Trace.line(import.meta.url, "AdTable.disconnect", { workspaceId, accountId });
    await this.db.run("DELETE FROM research_ad_accounts WHERE workspace_id = ? AND account_id = ?", [workspaceId, accountId]);
  }

  async markRead(workspaceId: string, accountId: string, error: string): Promise<void> {
    Trace.line(import.meta.url, "AdTable.markRead", { workspaceId, accountId, failed: error !== "" });
    const status = error ? "reconnect" : "connected";
    await this.db.run("UPDATE research_ad_accounts SET status = ?, error = ?, read_at = ? WHERE workspace_id = ? AND account_id = ?", [status, error, Clock.nowIso(), workspaceId, accountId]);
  }

  async save(workspaceId: string, accountId: string, rows: readonly AdInsight[], settledBefore: string): Promise<void> {
    Trace.line(import.meta.url, "AdTable.save", { workspaceId, accountId, rows: rows.length });
    const now = Clock.nowIso();
    for (const row of rows) {
      await this.db.run("DELETE FROM research_ad_results WHERE workspace_id = ? AND ad_id = ? AND date = ?", [workspaceId, row.ad_id, row.date]);
      await this.db.run(
        "INSERT INTO research_ad_results (workspace_id, account_id, ad_id, ad_name, date, spend, impressions, clicks, purchases, purchase_value, settled, read_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [workspaceId, accountId, row.ad_id, row.ad_name, row.date, row.spend, row.impressions, row.clicks, row.purchases, row.purchase_value, row.date < settledBefore ? 1 : 0, now],
      );
    }
  }

  async results(workspaceId: string, adIds?: readonly string[]): Promise<AdResult[]> {
    Trace.line(import.meta.url, "AdTable.results", { workspaceId, ads: adIds?.length ?? null });
    const rows = await this.db.all<ResultRow>("SELECT * FROM research_ad_results WHERE workspace_id = ? ORDER BY date", [workspaceId]);
    const wanted = adIds ? new Set(adIds) : null;
    return rows.filter((row) => !wanted || wanted.has(row.ad_id)).map((row) => ({ ...row, settled: Boolean(row.settled) }));
  }

  async link(workspaceId: string, draftId: string, adId: string, by: AdLink["by"]): Promise<AdLink> {
    Trace.line(import.meta.url, "AdTable.link", { workspaceId, draftId, adId, by });
    const known = (await this.links(workspaceId)).find((l) => l.draft_id === draftId && l.ad_id === adId);
    if (known) return known;
    const link: AdLink = { workspace_id: workspaceId, draft_id: draftId, ad_id: adId, by, created_at: Clock.nowIso(), outcome_at: "" };
    await this.db.run("INSERT INTO research_ad_links (workspace_id, draft_id, ad_id, by, created_at, outcome_at) VALUES (?,?,?,?,?,?)", [workspaceId, draftId, adId, by, link.created_at, ""]);
    return link;
  }

  links(workspaceId: string): Promise<AdLink[]> {
    Trace.line(import.meta.url, "AdTable.links", { workspaceId });
    return this.db.all<AdLink>("SELECT * FROM research_ad_links WHERE workspace_id = ? ORDER BY created_at", [workspaceId]);
  }

  async recorded(workspaceId: string, draftId: string, adId: string): Promise<void> {
    Trace.line(import.meta.url, "AdTable.recorded", { workspaceId, draftId, adId });
    await this.db.run("UPDATE research_ad_links SET outcome_at = ? WHERE workspace_id = ? AND draft_id = ? AND ad_id = ?", [Clock.nowIso(), workspaceId, draftId, adId]);
  }
}
