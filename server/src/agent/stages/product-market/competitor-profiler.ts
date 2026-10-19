import { CompetitorProfileSchema, type Competitor, type CompetitorProfile, type Product } from "../../../domain/index.js";
import { PriceCheck } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { COMPETITOR_PROFILE_SYSTEM } from "../../prompt/text/competitor-profile.js";
import type { UrlLedger } from "../../tools/url-ledger.js";

/** Reads one competitor's product into the facts its relationship to the client is decided from. */
export class CompetitorProfiler {
  static readonly MAX_TURNS = 15;

  async profile(context: RunContext, client: Product, competitor: Competitor): Promise<AgentResult<CompetitorProfile>> {
    Trace.line(import.meta.url, "CompetitorProfiler.profile", { competitorId: competitor.id });
    const agentId = `competitor:${competitor.domain}`;
    const { tools, urls } = context.kit(agentId, ["web_search", "web_fetch"]);
    return context.agent({
      agentId,
      system: COMPETITOR_PROFILE_SYSTEM,
      instructions: [
        `Competitor: ${competitor.brand}, ${competitor.product_name}`,
        `Its product page: ${competitor.url}`,
        `The client's key active ingredient: ${client.key_active}`,
        `The client's form factor, for reference: ${client.form_factor}`,
      ].join("\n"),
      tools,
      maxTurns: CompetitorProfiler.MAX_TURNS,
      submission: { schema: CompetitorProfileSchema, describe: "Hand back the competitor's profile.", check: (profile) => CompetitorProfiler.problems(profile, urls) },
    });
  }

  static problems(profile: CompetitorProfile, urls: UrlLedger): string[] {
    Trace.line(import.meta.url, "CompetitorProfiler.problems");
    const cited = [...profile.sources, ...(profile.price ? [profile.price.source_url] : [])];
    const problems = urls.unread(cited).map((url) => `${url} was never read with web_fetch; read it or cite a page you did read`);
    if (profile.has_key_active && !profile.key_active_as_listed) problems.push("has_key_active is true but key_active_as_listed is empty: say how the page names it");
    problems.push(...PriceCheck.problems(profile.price, (url) => urls.textOf(url), "price"));
    return problems;
  }
}
