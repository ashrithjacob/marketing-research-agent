import { AdKeywordsSchema, type Product } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AD_KEYWORDS_SYSTEM } from "../../prompt/text/ad-keywords.js";

/** Picks the ad-copy keywords a category's long-form ads would use, from the product brief; no tools. */
export class AdKeywordsAgent {
  static readonly AGENT_ID = "ad_keywords";
  static readonly MAX_TURNS = 3;

  async pick(context: RunContext, product: Product): Promise<AgentResult<{ keywords: string[] }>> {
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
      submission: { schema: AdKeywordsSchema, describe: "Hand back the keywords." },
    });
  }
}
