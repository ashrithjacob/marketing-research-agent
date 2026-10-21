import { CompetitorProposalSchema, type CompetitorProposal, type Product } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { AgentResult } from "../kernel/agent-runner.js";
import type { RunContext } from "../pipeline/run-context.js";
import { COMPETITOR_SEARCH_SYSTEM } from "../prompt/text/competitor-search.js";

import { CompetitorUrlCheck } from "./competitor-url-check.js";

/** Proposes competitors a finished run does not have yet, for the user to approve; never one already confirmed or proposed. */
export class CompetitorSearch {
  static readonly AGENT_ID = "competitor_search";
  static readonly MAX_TURNS = 20;

  async search(context: RunContext, product: Product, known: readonly string[]): Promise<AgentResult<CompetitorProposal>> {
    Trace.line(import.meta.url, "CompetitorSearch.search", { runId: context.run.id, known: known.length });
    const { tools, urls } = context.kit(CompetitorSearch.AGENT_ID, ["web_search", "web_fetch", "ad_search"]);
    return context.agent({
      agentId: CompetitorSearch.AGENT_ID,
      system: COMPETITOR_SEARCH_SYSTEM,
      instructions: CompetitorSearch.instructions(context, product, known),
      tools,
      maxTurns: CompetitorSearch.MAX_TURNS,
      submission: {
        schema: CompetitorProposalSchema,
        describe: "Hand back the new competitors to propose.",
        check: (proposal) => CompetitorUrlCheck.problems(proposal.competitors.map((c) => c.url), urls, product.url, known),
      },
    });
  }

  private static instructions(context: RunContext, product: Product, known: readonly string[]): string {
    Trace.line(import.meta.url, "CompetitorSearch.instructions");
    return [
      `Find more competitors for: ${product.brand} ${product.name}`,
      `Its own page: ${product.url}`,
      product.key_active ? `Key active: ${product.key_active}; form: ${product.form_factor ?? "unknown"}; category: ${product.category}` : "",
      `Markets: ${context.run.input.markets.join(", ")}`,
      "Known competitors, not to propose again:",
      ...known.map((url) => `- ${url}`),
    ]
      .filter(Boolean)
      .join("\n");
  }
}
