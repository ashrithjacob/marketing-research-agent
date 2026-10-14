import { AdSums, Scope, type Draft, type Playbook, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** How one playbook version did (spec §5.5): write tasks run on it, how many passed their check on the first finish, how the owner settled their drafts, and what the ads made from them returned once settled. */
export interface VersionScore {
  version: number;
  by: Playbook["by"];
  created_at: string;
  tasks: number;
  first_try: number;
  decided: number;
  accepted_unchanged: number;
  corrected: number;
  ads: number;
  spend: number;
  roas: number | null;
}

export interface PlaybookReport {
  playbook: Playbook;
  versions: VersionScore[];
  flag: string | null;
}

/** Scores every version of a workspace's playbooks from the store, and flags a version that did worse than the one before it over enough drafts to say so. Nothing is rolled back automatically. */
export class PlaybookScores {
  static readonly MIN_DECIDED = 5;
  static readonly MIN_ADS = 3;
  static readonly ACCEPT_DROP = 0.2;
  static readonly ROAS_DROP = 0.25;

  constructor(private readonly store: ResearchStore) {}

  async report(workspaceId: string, playbook: Playbook): Promise<PlaybookReport> {
    Trace.line(import.meta.url, "PlaybookScores.report", { workspaceId, key: playbook.key });
    const drafts = (await this.store.drafts.list(Scope.of(workspaceId), 500)).filter((d) => d.playbook === playbook.key);
    const versions = [];
    for (const each of await this.store.playbooks.history(workspaceId, playbook.key)) versions.push(await this.score(workspaceId, each, drafts.filter((d) => d.playbook_version === each.version)));
    return { playbook, versions, flag: PlaybookScores.flag(versions) };
  }

  private async score(workspaceId: string, version: Playbook, drafts: readonly Draft[]): Promise<VersionScore> {
    Trace.line(import.meta.url, "PlaybookScores.score", { key: version.key, version: version.version, drafts: drafts.length });
    let firstTry = 0;
    for (const draft of drafts) {
      const run = await this.store.getRun(draft.run_id);
      const refused = (await this.store.listPacketChecks(draft.run_id)).some((c) => !c.valid);
      if (run?.status === "completed" && !refused) firstTry += 1;
    }
    const decided = drafts.filter((d) => d.status === "approved" || d.status === "rejected");
    const ids = new Set(drafts.map((d) => d.id));
    const links = (await this.store.ads.links(workspaceId)).filter((l) => ids.has(l.draft_id));
    const settled = (await this.store.ads.results(workspaceId, links.map((l) => l.ad_id))).filter((r) => r.settled);
    const sums = AdSums.of(settled);
    return {
      version: version.version,
      by: version.by,
      created_at: version.created_at,
      tasks: drafts.length,
      first_try: firstTry,
      decided: decided.length,
      accepted_unchanged: decided.filter((d) => d.status === "approved" && d.by === "writer").length,
      corrected: drafts.filter((d) => d.status === "rejected" || d.by === "owner").length,
      ads: new Set(settled.map((r) => r.ad_id)).size,
      spend: sums.spend,
      roas: sums.roas,
    };
  }

  /** The newest version against the one before it: a fall in drafts accepted unchanged, or in return on ad spend, past the thresholds and over enough of each. */
  static flag(versions: readonly VersionScore[]): string | null {
    Trace.line(import.meta.url, "PlaybookScores.flag", { versions: versions.length });
    const [now, before] = versions;
    if (!now || !before) return null;
    const rate = (v: VersionScore) => v.accepted_unchanged / v.decided;
    if (now.decided >= PlaybookScores.MIN_DECIDED && before.decided >= PlaybookScores.MIN_DECIDED && rate(before) - rate(now) >= PlaybookScores.ACCEPT_DROP) {
      return `version ${now.version}: ${now.accepted_unchanged} of ${now.decided} drafts accepted unchanged, against ${before.accepted_unchanged} of ${before.decided} on version ${before.version}`;
    }
    if (now.roas !== null && before.roas !== null && now.ads >= PlaybookScores.MIN_ADS && before.ads >= PlaybookScores.MIN_ADS && now.roas <= before.roas * (1 - PlaybookScores.ROAS_DROP)) {
      return `version ${now.version}: return on ad spend ${now.roas.toFixed(2)} over ${now.ads} ads, against ${before.roas.toFixed(2)} over ${before.ads} on version ${before.version}`;
    }
    return null;
  }
}
