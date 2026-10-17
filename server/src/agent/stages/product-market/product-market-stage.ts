import { CompetitorRelationship, type Competitor, type Product, type StageName } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import type { Stage, StageInput, StageOutcome } from "../../pipeline/stage.js";

import { CompetitorProfiler } from "./competitor-profiler.js";
import { ProductBriefAgent } from "./product-brief-agent.js";

/** Stage 1: the client's product brief, then every confirmed competitor profiled and classified direct, indirect or other against it. */
export class ProductMarketStage implements Stage {
  readonly name: StageName = "product_market";

  constructor(
    private readonly brief = new ProductBriefAgent(),
    private readonly profiler = new CompetitorProfiler(),
    private readonly concurrency = 4,
  ) {}

  async run(input: StageInput): Promise<StageOutcome> {
    Trace.line(import.meta.url, "ProductMarketStage.run", { runId: input.context.run.id, competitors: input.competitors.length });
    const result = await this.brief.brief(input.context, input.product);
    if (result.status === "cancelled") return { status: "failed", summary: "", error: "stopped" };
    if (result.status === "failed") return { status: "failed", summary: "", error: `product brief: ${result.error}` };
    if (result.status === "invalid") return { status: "invalid", summary: "", error: `product brief refused: ${result.problems.join("; ")}` };
    const product = await input.context.store.products.saveBrief(input.product.id, result.value);
    const misses = await this.profileAll(input.context, product, input.competitors);
    const profiled = input.competitors.length - misses.length;
    if (profiled === 0 && input.competitors.length > 0) return { status: "invalid", summary: "", error: `no competitor could be profiled: ${misses.join("; ")}` };
    const summary = `Product brief: ${product.ingredients.length} ingredients, ${product.claims_on_page.length} claims. Competitors profiled: ${profiled} of ${input.competitors.length}.`;
    return { status: "completed", summary: misses.length > 0 ? `${summary} Not profiled: ${misses.join("; ")}` : summary, error: "" };
  }

  private async profileAll(context: RunContext, product: Product, competitors: readonly Competitor[]): Promise<string[]> {
    Trace.line(import.meta.url, "ProductMarketStage.profileAll", { count: competitors.length });
    const misses: string[] = [];
    const queue = [...competitors];
    const worker = async (): Promise<void> => {
      for (let next = queue.shift(); next && !context.signal.aborted; next = queue.shift()) {
        const miss = await this.profileOne(context, product, next);
        if (miss) misses.push(miss);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, competitors.length) }, worker));
    return misses;
  }

  private async profileOne(context: RunContext, product: Product, competitor: Competitor): Promise<string | null> {
    Trace.line(import.meta.url, "ProductMarketStage.profileOne", { competitorId: competitor.id });
    const result = await this.profiler.profile(context, product, competitor);
    if (result.status !== "completed") {
      const why = result.status === "invalid" ? result.problems.join(", ") : result.status === "failed" ? result.error : "stopped";
      return `${competitor.brand} (${why})`;
    }
    await context.store.competitors.saveProfile(competitor.id, result.value, CompetitorRelationship.classify(product, result.value));
    return null;
  }
}
