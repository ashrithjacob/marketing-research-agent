import type { Settings } from "../config/index.js";
import { ServiceUnavailableError, type AdInsight, type AdInsights } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";

interface InsightRow {
  ad_id?: string;
  ad_name?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

/** Meta's Insights API at `level=ad`, one row per ad per day, read with `ads_read` (docs/plan-meta-integration.md §5.1). Version v25.0 is pinned. A refused token is ServiceUnavailableError, so the account is marked to reconnect rather than read as empty. */
export class MetaInsights implements AdInsights {
  static readonly VERSION = "v25.0";
  static readonly PURCHASE = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"];
  static readonly FIELDS = "ad_id,ad_name,date_start,spend,impressions,clicks,actions,action_values";

  constructor(private readonly settings: Settings) {}

  async read(accountId: string, since: string, until: string, signal?: AbortSignal): Promise<AdInsight[]> {
    Trace.line(import.meta.url, "MetaInsights.read", { accountId, since, until });
    const { metaAccessToken, metaBaseUrl } = this.settings;
    if (!metaAccessToken) throw new ServiceUnavailableError("meta", "META_ACCESS_TOKEN is not set");
    const account = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
    const query = new URLSearchParams({ level: "ad", time_increment: "1", time_range: JSON.stringify({ since, until }), fields: MetaInsights.FIELDS, limit: "500", access_token: metaAccessToken });
    let url: string | null = `${metaBaseUrl.replace(/\/$/, "")}/${MetaInsights.VERSION}/${account}/insights?${query}`;
    const rows: AdInsight[] = [];
    while (url) {
      const page = await this.page(url, signal);
      rows.push(...page.data.map(MetaInsights.insight));
      url = page.next;
    }
    return rows;
  }

  private async page(url: string, signal?: AbortSignal): Promise<{ data: InsightRow[]; next: string | null }> {
    Trace.line(import.meta.url, "MetaInsights.page");
    const response = await Http.withTimeout(url, { method: "GET" }, this.settings.webTimeoutSeconds, signal);
    const body = (await response.json().catch(() => ({}))) as { data?: InsightRow[]; paging?: { next?: string }; error?: { code?: number; message?: string } };
    if (body.error || !response.ok) {
      const said = `Meta returned ${response.status}: ${body.error?.message ?? "no body"} (code ${body.error?.code ?? "none"})`.slice(0, 300);
      if (body.error?.code === 190 || body.error?.code === 200 || response.status === 401 || response.status === 403) throw new ServiceUnavailableError("meta", said);
      throw new Error(said);
    }
    return { data: body.data ?? [], next: body.paging?.next ?? null };
  }

  static insight(row: InsightRow): AdInsight {
    Trace.tick(import.meta.url, "MetaInsights.insight");
    return {
      ad_id: String(row.ad_id ?? ""),
      ad_name: String(row.ad_name ?? ""),
      date: String(row.date_start ?? ""),
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      purchases: MetaInsights.purchase(row.actions),
      purchase_value: MetaInsights.purchase(row.action_values),
    };
  }

  /** Purchases are an action type inside `actions`, not a field; the first purchase type present is counted, so one purchase is never counted twice. */
  static purchase(actions: { action_type: string; value: string }[] | undefined): number {
    Trace.tick(import.meta.url, "MetaInsights.purchase");
    for (const type of MetaInsights.PURCHASE) {
      const hit = (actions ?? []).find((a) => a.action_type === type);
      if (hit) return Number(hit.value);
    }
    return 0;
  }
}
