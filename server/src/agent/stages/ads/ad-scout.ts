import { MeteredAdLibrary } from "../../../adapters/index.js";
import type { ServicePrices } from "../../../config/index.js";
import { Markets, ScoutReportSchema, type AdLibrary, type Competitor, type Product, type ScoutReport } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AD_SCOUT_SYSTEM } from "../../prompt/text/ad-scout.js";
import { ReadAdTool } from "../../tools/read-ad-tool.js";
import { SearchLongFormTool } from "../../tools/search-long-form-tool.js";

import { ScoutLog } from "./scout-log.js";

export interface ScoutLimits {
  searches: number;
  maxAds: number;
  maxAdsPerBrand: number;
  minCopyChars: number;
}

/** An agent that studies the market's long-form ads as a growth marketer would, discovering brands as it goes; code checks it keeps only ads it saw, each once, within the caps. */
export class AdScout {
  static readonly AGENT_ID = "ad_scout";
  static readonly MAX_TURNS = 40;

  constructor(
    private readonly ads: AdLibrary,
    private readonly prices: ServicePrices,
    private readonly limits: ScoutLimits,
  ) {}

  async scout(context: RunContext, product: Product, competitors: readonly Competitor[]): Promise<{ result: AgentResult<ScoutReport>; log: ScoutLog }> {
    Trace.line(import.meta.url, "AdScout.scout", { competitors: competitors.length });
    const log = new ScoutLog(this.limits.searches);
    const library = new MeteredAdLibrary(this.ads, this.prices, context.meter(AdScout.AGENT_ID));
    const tools = [new SearchLongFormTool(library, Markets.countries(context.run.input.markets), this.limits.minCopyChars, log).tool(), new ReadAdTool(log).tool()];
    const result = await context.agent({
      agentId: AdScout.AGENT_ID,
      system: AD_SCOUT_SYSTEM,
      instructions: AdScout.brief(product, competitors, this.limits),
      tools,
      maxTurns: AdScout.MAX_TURNS,
      submission: { schema: ScoutReportSchema, describe: "Hand back the ads worth studying and the brands you found.", check: (report) => AdScout.problems(report, log, this.limits) },
    });
    return { result, log };
  }

  static problems(report: ScoutReport, log: ScoutLog, limits: ScoutLimits): string[] {
    Trace.line(import.meta.url, "AdScout.problems", { kept: report.kept.length });
    const ids = report.kept.map((kept) => kept.ad_id);
    const problems = ids.filter((id) => !log.ad(id)).map((id) => `ad ${id} was not in any of your searches; copy each id exactly as search_ads gave it`);
    problems.push(...ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `ad ${id} is kept twice`));
    if (ids.length > limits.maxAds) problems.push(`${ids.length} ads kept; keep at most ${limits.maxAds}, the most useful`);
    const perBrand = new Map<string, number>();
    for (const id of ids) {
      const domain = (log.ad(id)?.landing_domain ?? "").replace(/^www\./, "");
      if (domain) perBrand.set(domain, (perBrand.get(domain) ?? 0) + 1);
    }
    for (const [domain, count] of perBrand) if (count > limits.maxAdsPerBrand) problems.push(`${count} ads kept from ${domain}; keep at most ${limits.maxAdsPerBrand} per brand, its best`);
    return problems;
  }

  private static brief(product: Product, competitors: readonly Competitor[], limits: ScoutLimits): string {
    Trace.line(import.meta.url, "AdScout.brief", { competitors: competitors.length });
    const claims = product.claims_on_page.slice(0, 5).map((claim) => claim.text).join(" | ");
    return [
      `The client: ${product.brand} ${product.name}, a ${product.category || "product"} (${product.form_factor ?? "form unknown"}) sold on ${product.key_active || "its key ingredient"}.`,
      claims ? `Its own claims: ${claims}` : "",
      `Confirmed competitors: ${competitors.map((c) => `${c.brand} (${c.domain}, ${c.relationship ?? "unclassified"})`).join("; ") || "none"}.`,
      `Budget: ${limits.searches} searches; keep at most ${limits.maxAds} ads, at most ${limits.maxAdsPerBrand} from one brand.`,
    ]
      .filter((line) => line !== "")
      .join("\n");
  }
}
