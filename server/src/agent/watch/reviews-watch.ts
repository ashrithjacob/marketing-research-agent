import { Scope, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { Watch } from "./watchers.js";

/** The reviews watcher (spec §7.3), free: once a day, each Amazon listing the workspace's research looked up whose stored reviews are older than the reuse window. It only signals: a fresh pull spends Apify money, so it starts only by the owner's approval. Each stale pull is signalled once. */
export class ReviewsWatch implements Watch {
  readonly kind = "reviews";
  static readonly DAY_MS = 86_400_000;

  constructor(
    private readonly store: ResearchStore,
    private readonly reuseDays: number,
    private readonly signal: (workspaceId: string, text: string, key: string) => Promise<void>,
  ) {}

  async check(workspaceId: string, now: number): Promise<number> {
    Trace.line(import.meta.url, "ReviewsWatch.check", { workspaceId });
    const stale: string[] = [];
    for (const [asin, title] of await this.listings(workspaceId)) {
      const pulled = await this.store.pulls.newest("amazon", asin);
      if (!pulled) continue;
      const days = Math.floor((now - Date.parse(pulled)) / ReviewsWatch.DAY_MS);
      const key = `${this.kind}:${asin}`;
      if (days <= this.reuseDays || (await this.store.watch.mark(workspaceId, key)) === pulled) continue;
      await this.store.watch.setMark(workspaceId, key, pulled);
      stale.push(`${title} (${asin}), pulled ${days} days ago`);
    }
    const day = new Date(now).toISOString().slice(0, 10);
    if (stale.length > 0) await this.signal(workspaceId, `Reviews past the ${this.reuseDays}-day reuse window: ${stale.join("; ")}. A fresh pull spends Apify money, so it needs the owner's approval: ask them before suggesting review mining.`, `reviews:${day}`);
    return now + ReviewsWatch.DAY_MS;
  }

  /** The Amazon listings this workspace's runs matched to their targets, by ASIN. */
  private async listings(workspaceId: string): Promise<Map<string, string>> {
    Trace.line(import.meta.url, "ReviewsWatch.listings", { workspaceId });
    const found = new Map<string, string>();
    for (const run of (await this.store.listRuns(Scope.of(workspaceId), 200)).filter((r) => r.stage === 1)) {
      for (const target of await this.store.listings.list(run.id)) if (target.matches && target.listing?.asin) found.set(target.listing.asin, target.listing.title);
    }
    return found;
  }
}
