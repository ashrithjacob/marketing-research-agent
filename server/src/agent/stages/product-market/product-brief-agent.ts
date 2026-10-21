import { ProductBriefSchema, type Product, type ProductBrief } from "../../../domain/index.js";
import { PackCheck, PriceCheck } from "../../../extract/index.js";
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
      instructions: ProductBriefAgent.instructions(product),
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
      ...brief.price_points.map((point) => point.source_url),
      ...(brief.subscription_terms ? [brief.subscription_terms.source_url] : []),
      ...(brief.pack ? [brief.pack.source_url] : []),
      ...brief.ingredients.map((ingredient) => ingredient.source_url),
      ...brief.claims_on_page.map((claim) => claim.source_url),
      ...(brief.coa_url ? [brief.coa_url] : []),
      ...brief.miscellaneous.map((fact) => fact.source_url),
    ];
  }

  static problems(brief: ProductBrief, urls: UrlLedger): string[] {
    Trace.line(import.meta.url, "ProductBriefAgent.problems");
    const unread = urls.unread(ProductBriefAgent.citedUrls(brief)).map((url) => `source_url ${url} was never read with web_fetch; read it or cite a page you did read`);
    const textOf = (url: string) => urls.textOf(url);
    const points = brief.price_points.flatMap((point, i) => PriceCheck.problems(point, textOf, `price_points[${i}]`));
    return [...unread, ...PriceCheck.problems(brief.price, textOf, "price"), ...points, ...PackCheck.problems(brief.pack, textOf)];
  }

  private static instructions(product: Product): string {
    Trace.line(import.meta.url, "ProductBriefAgent.instructions");
    return [`Product page: ${product.url}`, `Product as resolved: ${product.name}`].join("\n");
  }
}
