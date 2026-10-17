import { ResolutionSchema, type AnalysisInput, type Resolution } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { AgentResult } from "../kernel/agent-runner.js";
import type { RunContext } from "../pipeline/run-context.js";
import { RESOLVER_SYSTEM } from "../prompt/text/resolver.js";
import type { UrlLedger } from "../tools/url-ledger.js";

/** Turns what the user typed into a product page and a competitor list for them to confirm. */
export class ProductResolver {
  static readonly AGENT_ID = "resolver";
  static readonly MAX_TURNS = 20;

  async resolve(context: RunContext): Promise<AgentResult<Resolution>> {
    Trace.line(import.meta.url, "ProductResolver.resolve", { runId: context.run.id });
    const { tools, urls } = context.kit(ProductResolver.AGENT_ID, ["web_search", "web_fetch", "ad_search"]);
    return context.agent({
      agentId: ProductResolver.AGENT_ID,
      system: RESOLVER_SYSTEM,
      instructions: ProductResolver.instructions(context.run.input),
      tools,
      maxTurns: ProductResolver.MAX_TURNS,
      submission: {
        schema: ResolutionSchema,
        describe: "Hand back the product, any alternatives, and the competitors to propose.",
        check: (resolution) => ProductResolver.problems(resolution, urls),
      },
    });
  }

  static problems(resolution: Resolution, urls: UrlLedger): string[] {
    Trace.line(import.meta.url, "ProductResolver.problems");
    const problems = urls.unread([resolution.product.url]).map((url) => `product.url ${url} was never read with web_fetch; read it first`);
    const competitorUrls = resolution.competitors.map((competitor) => competitor.url);
    for (const url of urls.unknown(competitorUrls)) problems.push(`competitor url ${url} did not appear in any search, ad or page you read; use a url you actually met`);
    if (competitorUrls.includes(resolution.product.url)) problems.push("the product itself is listed as a competitor");
    return problems;
  }

  private static instructions(input: AnalysisInput): string {
    Trace.line(import.meta.url, "ProductResolver.instructions");
    return [
      input.product_url ? `Product url: ${input.product_url}` : `Product name: ${input.product_name}`,
      `Markets: ${input.markets.join(", ")}`,
      input.known_competitors.length > 0 ? `Competitors the user named, include each: ${input.known_competitors.join("; ")}` : "The user named no competitors.",
      input.price_offer ? `What the user said about price and offer: ${input.price_offer}` : "",
    ]
      .filter((line) => line !== "")
      .join("\n");
  }
}
