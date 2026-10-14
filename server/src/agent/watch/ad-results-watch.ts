import { AdSums, ServiceUnavailableError, type AdInsights, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { AdOutcomes } from "./ad-outcomes.js";
import type { Watch } from "./watchers.js";

/** The ad-results watcher (spec §7.3; docs/plan-meta-integration.md Phase D): every six hours, the last five weeks of each connected Meta ad account, stored per ad per day; then drafts linked to their ads and settled results recorded as outcomes. A refused token marks the account to reconnect and says so once. */
export class AdResultsWatch implements Watch {
  readonly kind = "ad_results";
  static readonly EVERY_MS = 6 * 3_600_000;
  static readonly WINDOW_DAYS = 35;

  constructor(
    private readonly store: ResearchStore,
    private readonly insights: AdInsights | null,
    private readonly signal: (workspaceId: string, text: string, key: string) => Promise<void>,
  ) {}

  async check(workspaceId: string, now: number): Promise<number> {
    Trace.line(import.meta.url, "AdResultsWatch.check", { workspaceId });
    const accounts = await this.store.ads.accounts(workspaceId);
    if (accounts.length === 0 || !this.insights) return now + AdResultsWatch.EVERY_MS;
    const until = new Date(now).toISOString().slice(0, 10);
    const since = new Date(now - AdResultsWatch.WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const account of accounts) {
      try {
        const rows = await this.insights.read(account.account_id, since, until);
        await this.store.ads.save(workspaceId, account.account_id, rows, AdSums.settledBefore(new Date(now)));
        await this.store.ads.markRead(workspaceId, account.account_id, "");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.store.ads.markRead(workspaceId, account.account_id, message);
        const refused = error instanceof ServiceUnavailableError;
        if (refused && account.status !== "reconnect") await this.signal(workspaceId, `Ad results: Meta refused the read of ad account ${account.account_id} (${message}); it needs reconnecting.`, `ad_results:reconnect:${account.account_id}:${until}`);
      }
    }
    const outcomes = new AdOutcomes(this.store);
    await outcomes.link(workspaceId);
    const recorded = await outcomes.record(workspaceId);
    if (recorded.length > 0) await this.signal(workspaceId, `Ad results settled for drafts the system wrote: ${recorded.join("; ")}.`, `ad_results:outcome:${until}:${recorded.length}`);
    return now + AdResultsWatch.EVERY_MS;
  }
}
