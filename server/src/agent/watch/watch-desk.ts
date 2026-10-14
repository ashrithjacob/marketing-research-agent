import { AdSums, Scope, type AdAccount, type AdTotals, type ResearchStore, type WatchedBrand } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";

/** What the owner points the watchers at: competitors to watch for new ads, Meta ad accounts to read results from, and which ad a draft became. */
export class WatchDesk {
  constructor(private readonly store: ResearchStore) {}

  async addBrand(workspaceId: string, term: string, searchIn: string): Promise<WatchedBrand> {
    Trace.line(import.meta.url, "WatchDesk.addBrand", { workspaceId, searchIn });
    if (!term.trim()) throw new RunError("a watched competitor needs a brand name or a domain");
    if (searchIn !== "brand" && searchIn !== "domain") throw new RunError("search_in is brand or domain");
    return this.store.watch.addBrand(workspaceId, term.trim(), searchIn);
  }

  async connect(workspaceId: string, accountId: string): Promise<AdAccount> {
    Trace.line(import.meta.url, "WatchDesk.connect", { workspaceId });
    const id = accountId.trim().replace(/^act_/, "");
    if (!/^\d{5,25}$/.test(id)) throw new RunError("a Meta ad account id is its digits, as Ads Manager shows it, with or without act_");
    return this.store.ads.connect(workspaceId, id);
  }

  /** The owner names the Meta ad a draft became; only an approved draft can have run as an ad. */
  async link(workspaceId: string, draftId: string, adId: string): Promise<void> {
    Trace.line(import.meta.url, "WatchDesk.link", { workspaceId, draftId });
    const draft = await this.store.drafts.get(Scope.of(workspaceId), draftId);
    if (!draft) throw new RunError(`no draft ${draftId}`);
    if (draft.status !== "approved") throw new RunError("only an approved draft can be linked to an ad");
    if (!/^\d{5,25}$/.test(adId.trim())) throw new RunError("a Meta ad id is its digits");
    await this.store.ads.link(workspaceId, draftId, adId.trim(), "owner");
  }

  /** The ads a draft became, each with its settled and its provisional totals, labelled apart as the owner sees them. */
  async draftAds(workspaceId: string, draftId: string): Promise<{ ad_id: string; by: string; tag: string; settled: AdTotals; provisional: AdTotals }[]> {
    Trace.line(import.meta.url, "WatchDesk.draftAds", { workspaceId, draftId });
    const links = (await this.store.ads.links(workspaceId)).filter((l) => l.draft_id === draftId);
    const out = [];
    for (const link of links) {
      const rows = await this.store.ads.results(workspaceId, [link.ad_id]);
      out.push({ ad_id: link.ad_id, by: link.by, tag: AdSums.tag(draftId), settled: AdSums.of(rows.filter((r) => r.settled)), provisional: AdSums.of(rows.filter((r) => !r.settled)) });
    }
    return out;
  }
}
