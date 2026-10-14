import { AdSums, FeedbackStrengths, Scope, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Ad results turned into feedback on the drafts they came from (spec §5.2, `outcome`): an approved draft is linked to the ad whose name carries its tag, and once that ad has a week of settled days its totals are recorded once against the draft. */
export class AdOutcomes {
  static readonly MIN_SETTLED_DAYS = 7;

  constructor(private readonly store: ResearchStore) {}

  /** Links approved drafts to the ads named with their tag; returns how many links are new. */
  async link(workspaceId: string): Promise<number> {
    Trace.line(import.meta.url, "AdOutcomes.link", { workspaceId });
    const approved = (await this.store.drafts.list(Scope.of(workspaceId), 500)).filter((d) => d.status === "approved");
    const ads = new Map((await this.store.ads.results(workspaceId)).map((r) => [r.ad_id, r.ad_name]));
    const known = new Set((await this.store.ads.links(workspaceId)).map((l) => `${l.draft_id}/${l.ad_id}`));
    let added = 0;
    for (const draft of approved) {
      for (const [adId, name] of ads) {
        if (!name.includes(AdSums.tag(draft.id)) || known.has(`${draft.id}/${adId}`)) continue;
        await this.store.ads.link(workspaceId, draft.id, adId, "name");
        added += 1;
      }
    }
    return added;
  }

  /** Records each linked ad's settled totals as `outcome` feedback once it has enough settled days; returns what was recorded, one line each. */
  async record(workspaceId: string): Promise<string[]> {
    Trace.line(import.meta.url, "AdOutcomes.record", { workspaceId });
    const said: string[] = [];
    for (const link of (await this.store.ads.links(workspaceId)).filter((l) => !l.outcome_at)) {
      const settled = (await this.store.ads.results(workspaceId, [link.ad_id])).filter((r) => r.settled);
      const totals = AdSums.of(settled);
      if (totals.days < AdOutcomes.MIN_SETTLED_DAYS) continue;
      const draft = await this.store.drafts.get(Scope.of(workspaceId), link.draft_id);
      const text = `ad ${link.ad_id}: $${totals.spend.toFixed(2)} spent over ${totals.days} settled days, ${totals.purchases} purchases, return on ad spend ${totals.roas === null ? "none" : totals.roas.toFixed(2)}`;
      const target = FeedbackStrengths.target("draft", link.draft_id, { run_id: draft?.run_id ?? "" });
      await this.store.feedback.record(workspaceId, { verdict: "outcome", target, text, diff: { ad_id: link.ad_id, ...totals } });
      await this.store.ads.recorded(workspaceId, link.draft_id, link.ad_id);
      said.push(text);
    }
    return said;
  }
}
