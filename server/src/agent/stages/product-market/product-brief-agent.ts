import { ProductBriefSchema, type AnalysisInput, type Product, type ProductBrief } from "../../../domain/index.js";
import { PriceCheck } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { PRODUCT_BRIEF_SYSTEM } from "../../prompt/text/product-brief.js";
import type { UrlLedger } from "../../tools/url-ledger.js";

/** Researches the client's own product into a brief whose every fact cites a page the agent read. */
export class ProductBriefAgent {
  static readonly AGENT_ID = "product_brief";
  static readonly MAX_TURNS = 25;

  async brief(context: RunContext, product: Product): Promise<AgentResult<ProductBrief>> {
    Trace.line(import.meta.url, "ProductBriefAgent.brief", { productId: product.id });
    const { tools, urls } = context.kit(ProductBriefAgent.AGENT_ID, ["web_search", "web_fetch"]);
    return context.agent({
      agentId: ProductBriefAgent.AGENT_ID,
      system: PRODUCT_BRIEF_SYSTEM,
      instructions: ProductBriefAgent.instructions(product, context.run.input),
      tools,
      maxTurns: ProductBriefAgent.MAX_TURNS,
      submission: { schema: ProductBriefSchema, describe: "Hand back the product brief.", check: (brief) => ProductBriefAgent.problems(brief, urls) },
    });
  }

  static citedUrls(brief: ProductBrief): string[] {
    Trace.line(import.meta.url, "ProductBriefAgent.citedUrls");
    return [
      ...(brief.price ? [brief.price.source_url] : []),
      brief.offer.source_url,
      ...brief.ingredients.map((ingredient) => ingredient.source_url),
      ...brief.claims_on_page.map((claim) => claim.source_url),
    ];
  }

  static problems(brief: ProductBrief, urls: UrlLedger): string[] {
    Trace.line(import.meta.url, "ProductBriefAgent.problems");
    const unread = urls.unread(ProductBriefAgent.citedUrls(brief)).map((url) => `source_url ${url} was never read with web_fetch; read it or cite a page you did read`);
    return [...unread, ...PriceCheck.problems(brief.price, (url) => urls.textOf(url), "price")];
  }

  private static instructions(product: Product, input: AnalysisInput): string {
    Trace.line(import.meta.url, "ProductBriefAgent.instructions");
    return [
      `Product page: ${product.url}`,
      `Product as resolved: ${product.name}`,
      input.price_offer ? `The user says about price and offer (check it against the page): ${input.price_offer}` : "",
      input.brand_constraints ? `The brand's own notes on claims it can and cannot make: ${input.brand_constraints}` : "",
    ]
      .filter((line) => line !== "")
      .join("\n");
  }
}
