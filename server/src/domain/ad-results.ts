import { Trace } from "../trace/index.js";

/** A Meta ad account a workspace reads results from (docs/plan-meta-integration.md §5.2). `reconnect` means the last read was refused, so its numbers are stale, never silently empty. */
export interface AdAccount {
  workspace_id: string;
  account_id: string;
  status: "connected" | "reconnect";
  error: string;
  connected_at: string;
  read_at: string;
}

/** One ad's numbers for one day, as Meta's Insights API reports them at `level=ad`. */
export interface AdInsight {
  ad_id: string;
  ad_name: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
}

/** A day of an ad as stored: provisional until 28 days after its date, when Meta stops changing it, then settled. */
export interface AdResult extends AdInsight {
  workspace_id: string;
  account_id: string;
  settled: boolean;
  read_at: string;
}

/** Which live ad a draft became: pasted on the draft by the owner, or matched by the draft's tag in the ad's name. `outcome_at` is when its settled result was recorded as feedback. */
export interface AdLink {
  workspace_id: string;
  draft_id: string;
  ad_id: string;
  by: "owner" | "name";
  created_at: string;
  outcome_at: string;
}

/** Reads ad results from the ad platform; Meta's Insights API in production. */
export interface AdInsights {
  read(accountId: string, since: string, until: string, signal?: AbortSignal): Promise<AdInsight[]>;
}

export interface AdBook {
  accounts(workspaceId: string): Promise<AdAccount[]>;
  connect(workspaceId: string, accountId: string): Promise<AdAccount>;
  disconnect(workspaceId: string, accountId: string): Promise<void>;
  markRead(workspaceId: string, accountId: string, error: string): Promise<void>;
  save(workspaceId: string, accountId: string, rows: readonly AdInsight[], settledBefore: string): Promise<void>;
  results(workspaceId: string, adIds?: readonly string[]): Promise<AdResult[]>;
  link(workspaceId: string, draftId: string, adId: string, by: AdLink["by"]): Promise<AdLink>;
  links(workspaceId: string): Promise<AdLink[]>;
  recorded(workspaceId: string, draftId: string, adId: string): Promise<void>;
}

/** An ad's totals over the days given: spend, purchases, return on ad spend (purchase value ÷ spend), cost per purchase and click-through rate. */
export interface AdTotals {
  days: number;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
}

export class AdSums {
  static of(days: readonly AdInsight[]): AdTotals {
    Trace.line(import.meta.url, "AdSums.of", { days: days.length });
    const sum = (pick: (row: AdInsight) => number) => days.reduce((total, row) => total + pick(row), 0);
    const spend = sum((r) => r.spend);
    const purchases = sum((r) => r.purchases);
    const impressions = sum((r) => r.impressions);
    const clicks = sum((r) => r.clicks);
    const value = sum((r) => r.purchase_value);
    return {
      days: new Set(days.map((r) => r.date)).size,
      spend,
      impressions,
      clicks,
      purchases,
      purchase_value: value,
      roas: spend > 0 ? value / spend : null,
      cpa: purchases > 0 ? spend / purchases : null,
      ctr: impressions > 0 ? clicks / impressions : null,
    };
  }

  /** The tag an owner puts in an ad's name so the reader links it to its draft without being told. */
  static tag(draftId: string): string {
    Trace.line(import.meta.url, "AdSums.tag", { draftId });
    return `mra-${draftId.slice(0, 8)}`;
  }

  /** The day results settle: Meta's numbers for a date do not change 28 days after it. */
  static settledBefore(now: Date): string {
    Trace.line(import.meta.url, "AdSums.settledBefore");
    return new Date(now.getTime() - 28 * 86_400_000).toISOString().slice(0, 10);
  }
}
