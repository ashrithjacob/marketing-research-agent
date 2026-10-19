import { AdKeywordsSchema, type AdKeywords, type Product } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AD_KEYWORDS_SYSTEM } from "../../prompt/text/ad-keywords.js";

/** Picks the category's searches from the product brief: the key active by name, and problem phrases of two words or more; code refuses a list that loses the key active or falls back on a single generic word. */
export class AdKeywordsAgent {
  static readonly AGENT_ID = "ad_keywords";
  static readonly MAX_TURNS = 3;

  async pick(context: RunContext, product: Product): Promise<AgentResult<AdKeywords>> {
    Trace.line(import.meta.url, "AdKeywordsAgent.pick", { productId: product.id });
    return context.agent({
      agentId: AdKeywordsAgent.AGENT_ID,
      system: AD_KEYWORDS_SYSTEM,
      instructions: [
        `Product: ${product.brand} ${product.name}`,
        `Category: ${product.category}`,
        `Key ingredient: ${product.key_active}`,
        `Its own claims: ${product.claims_on_page.map((claim) => claim.text).join(" | ") || "none recorded"}`,
      ].join("\n"),
      tools: [],
      maxTurns: AdKeywordsAgent.MAX_TURNS,
      submission: { schema: AdKeywordsSchema, describe: "Hand back the ingredient terms and problem phrases.", check: (keywords) => AdKeywordsAgent.problems(keywords, product.key_active) },
    });
  }

  static problems(keywords: AdKeywords, keyActive: string): string[] {
    Trace.line(import.meta.url, "AdKeywordsAgent.problems", { keyActive });
    const words = keyActive.toLowerCase().split(/[^a-z]+/).filter((word) => word.length >= 4);
    const named = words.length === 0 || keywords.ingredient_terms.some((term) => words.some((word) => term.toLowerCase().includes(word)));
    const problems = named ? [] : [`no ingredient term names the key active (${keyActive}); include it, e.g. ${words[0]}`];
    for (const phrase of keywords.problem_phrases) if (phrase.trim().split(/\s+/).length < 2) problems.push(`"${phrase}" is one word; use the buyer's phrase of two words or more`);
    return problems;
  }
}
