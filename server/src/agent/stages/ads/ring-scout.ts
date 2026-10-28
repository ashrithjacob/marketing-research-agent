import { MeteredAdLibrary } from "../../../adapters/index.js";
import type { ServicePrices } from "../../../config/index.js";
import { RingPullSchema, type AdLibrary, type AdRing, type Competitor, type Product, type PulledAd, type RingPull } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { RING_BRIEFS, RING_SCOUT_SYSTEM } from "../../prompt/text/ring-scout.js";
import { AdCategoriesTool } from "../../tools/ad-categories-tool.js";
import { PullAdsTool, type AdPullRules } from "../../tools/pull-ads-tool.js";
import { ReadPulledAdTool } from "../../tools/read-pulled-ad-tool.js";

import { RingLog } from "./ring-log.js";

/** One agent pulling one ring's ads with TrendTrack's filters; code checks it keeps only ads it was shown, each once, its quota or fewer, and fewer only once the market is searched out. */
export class RingScout {
  static readonly MAX_TURNS = 40;
  static readonly BUDGET_PER_QUOTA = 2.5;
  static readonly SEARCHES_BEFORE_SHORTFALL = 8;

  constructor(
    private readonly ads: AdLibrary,
    private readonly prices: ServicePrices,
    private readonly rules: AdPullRules,
  ) {}

  async pull(context: RunContext, ring: AdRing, quota: number, product: Product, competitors: readonly Competitor[]): Promise<{ result: AgentResult<RingPull>; pulled: PulledAd[] }> {
    Trace.line(import.meta.url, "RingScout.pull", { ring, quota });
    const budget = Math.ceil(quota * RingScout.BUDGET_PER_QUOTA);
    const log = new RingLog(budget);
    const agentId = `ring_scout:${ring}`;
    const ads = new MeteredAdLibrary(this.ads, this.prices, context.meter(agentId));
    const result = await context.agent({
      agentId,
      system: RING_SCOUT_SYSTEM,
      instructions: [RING_BRIEFS[ring], RingScout.brief(product, competitors, context.run.input.markets, { quota, budget }, this.rules)].join("\n\n"),
      tools: [new PullAdsTool(ads, this.rules, log).tool(), new ReadPulledAdTool(log).tool(), new AdCategoriesTool(ads).tool()],
      maxTurns: RingScout.MAX_TURNS,
      submission: { schema: RingPullSchema, describe: `Hand back the refs of the ${ring} ads you keep.`, check: (pull) => RingScout.problems(pull, log, quota) },
    });
    const pulled = result.status === "completed" ? result.value.kept.map((ref) => ({ hit: log.hit(ref)!, ring, found_by: log.found(ref) })) : [];
    return { result, pulled };
  }

  static problems(pull: RingPull, log: RingLog, quota: number): string[] {
    Trace.line(import.meta.url, "RingScout.problems", { kept: pull.kept.length, quota });
    const problems = pull.kept.filter((ref) => !log.hit(ref)).map((ref) => `${ref} was not shown by pull_ads; copy each ref exactly`);
    problems.push(...pull.kept.filter((ref, i) => pull.kept.indexOf(ref) !== i).map((ref) => `${ref} is kept twice`));
    if (pull.kept.length > quota) problems.push(`${pull.kept.length} ads kept; your quota is ${quota}: keep the strongest ${quota}`);
    if (pull.kept.length < quota) {
      if (!pull.shortfall) problems.push(`${pull.kept.length} of ${quota} ads kept: pull more, or say in shortfall why the market has no more`);
      const searchedOut = log.spent || log.unfinished.length === 0 || log.searchCount >= RingScout.SEARCHES_BEFORE_SHORTFALL;
      if (!searchedOut) problems.push(`${pull.kept.length} of ${quota} ads kept after ${log.searchCount} searches, and ${log.unfinished.map((s) => `${s.id} (${s.total - s.seen} unseen)`).join(", ")} still have pages you have not seen: page through them or try other searches`);
    }
    return problems;
  }

  private static brief(product: Product, competitors: readonly Competitor[], markets: readonly string[], { quota, budget }: { quota: number; budget: number }, rules: AdPullRules): string {
    Trace.line(import.meta.url, "RingScout.brief", { competitors: competitors.length });
    const claims = product.claims_on_page.slice(0, 5).map((claim) => claim.text).join(" | ");
    return [
      `The client: ${product.brand} ${product.name}, a ${product.category || "product"}${product.form_factor ? ` (${product.form_factor})` : ""} sold on ${product.key_active || "its key ingredient"}.`,
      claims ? `Its claims: ${claims}` : "",
      `Confirmed competitors: ${competitors.map((c) => `${c.brand} (${c.domain})`).join("; ") || "none"}.`,
      `Markets: ${markets.join(", ")}. Every search is held to ads running ${rules.minDaysRunning}+ days with ${rules.minCopyChars}+ characters of copy.`,
      `Your quota: ${quota} ads. Your budget: ${budget} ads returned across all your searches.`,
    ]
      .filter((line) => line !== "")
      .join("\n");
  }
}
