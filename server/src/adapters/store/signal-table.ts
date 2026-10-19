import type { ShopSignalCache, ShopSignals } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

export class SignalTable implements ShopSignalCache {
  constructor(private readonly db: SqlDatabase) {}

  async get(domains: readonly string[]): Promise<Map<string, ShopSignals>> {
    Trace.line(import.meta.url, "SignalTable.get", { count: domains.length });
    if (domains.length === 0) return new Map();
    const rows = await this.db.all<ShopSignals>(
      `SELECT domain, shop_id, monthly_visits, active_ads FROM shop_signals WHERE domain IN (${domains.map(() => "?").join(",")})`,
      [...domains],
    );
    return new Map(rows.map((row) => [row.domain, row]));
  }

  async put(signals: ShopSignals): Promise<void> {
    Trace.line(import.meta.url, "SignalTable.put", { domain: signals.domain });
    await this.db.run(
      "INSERT INTO shop_signals (domain, shop_id, monthly_visits, active_ads) VALUES (?,?,?,?) ON CONFLICT (domain) DO UPDATE SET shop_id = EXCLUDED.shop_id," +
        " monthly_visits = EXCLUDED.monthly_visits, active_ads = EXCLUDED.active_ads, fetched_at = now()",
      [signals.domain, signals.shop_id, signals.monthly_visits, signals.active_ads],
    );
  }
}
