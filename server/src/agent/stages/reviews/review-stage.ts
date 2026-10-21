import type { Competitor, CollectedReview, ReviewSource, ReviewSourceName, ReviewTarget, StageName } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import type { Stage, StageInput, StageOutcome } from "../../pipeline/stage.js";

import type { ReviewListings } from "./review-listings.js";

/** Stage 2: up to the per-product limit of reviews for the client's product and every confirmed competitor, from each listing in turn until the limit is met. */
export class ReviewStage implements Stage {
  readonly name: StageName = "reviews";

  constructor(
    private readonly listings: ReviewListings,
    private readonly sources: ReadonlyMap<ReviewSourceName, ReviewSource>,
    private readonly perProduct: number,
    private readonly concurrency = 3,
  ) {}

  async run(input: StageInput): Promise<StageOutcome> {
    Trace.line(import.meta.url, "ReviewStage.run", { runId: input.context.run.id, competitors: input.competitors.length });
    const { total, summary } = await this.collectAll(input.context, [{ target: ReviewStage.client(input), brand: input.product.brand || input.product.name }, ...this.competitorTargets(input)]);
    return total > 0 ? { status: "completed", summary, error: "" } : { status: "invalid", summary, error: "no reviews could be collected for any product" };
  }

  async add(input: StageInput): Promise<string> {
    Trace.line(import.meta.url, "ReviewStage.add", { runId: input.context.run.id, competitors: input.competitors.length });
    return (await this.collectAll(input.context, this.competitorTargets(input))).summary;
  }

  private competitorTargets(input: StageInput): Array<{ target: ReviewTarget; brand: string }> {
    Trace.line(import.meta.url, "ReviewStage.competitorTargets", { competitors: input.competitors.length });
    return input.competitors.map((c) => ({ target: ReviewStage.competitor(input, c), brand: c.brand }));
  }

  private async collectAll(context: RunContext, targets: Array<{ target: ReviewTarget; brand: string }>): Promise<{ total: number; summary: string }> {
    Trace.line(import.meta.url, "ReviewStage.collectAll", { targets: targets.length });
    const lines: string[] = [];
    let total = 0;
    const queue = [...targets];
    const worker = async (): Promise<void> => {
      for (let next = queue.shift(); next && !context.signal.aborted; next = queue.shift()) {
        const { saved, line } = await this.collect(context, next.target, next.brand);
        total += saved;
        lines.push(line);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, targets.length) }, worker));
    return { total, summary: `${total} reviews stored. ${lines.join("; ")}.` };
  }

  private async collect(context: RunContext, target: ReviewTarget, brand: string): Promise<{ saved: number; line: string }> {
    Trace.line(import.meta.url, "ReviewStage.collect", { target: target.name });
    const found = await this.listings.of(context, target, brand);
    const counts: string[] = [];
    const answered: string[] = [];
    let collected: CollectedReview[] = [];
    for (const listing of found.listings) {
      if (collected.length >= this.perProduct || context.signal.aborted) break;
      try {
        const batch = await this.sources.get(listing.source)!.collect(listing, this.perProduct - collected.length, context.signal);
        collected = [...collected, ...batch];
        if (batch.length > 0) answered.push(listing.source);
        counts.push(batch.length > 0 ? `${batch.length} ${listing.source}` : ReviewStage.empty(listing.source));
      } catch (error) {
        counts.push(`${listing.source} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await context.store.reviews.recordSources(target, { asins: found.asins, reviewApp: answered.includes("judgeme") ? "judgeme" : null });
    const saved = await context.store.reviews.save(context.run.account_id, target, collected);
    await context.emit("reviews.collected", { target: target.name, competitor_id: target.competitor_id, collected: collected.length, saved });
    const detail = [...counts, ...found.notes].join(", ") || "no review source found";
    return { saved, line: `${target.name}: ${saved} new (${detail})` };
  }

  static empty(source: ReviewSourceName): string {
    Trace.line(import.meta.url, "ReviewStage.empty", { source });
    return source === "judgeme" ? "Judge.me is installed but holds no reviews for this product" : "Amazon listing has no written reviews";
  }

  private static client(input: StageInput): ReviewTarget {
    Trace.line(import.meta.url, "ReviewStage.client");
    return { product_id: input.product.id, competitor_id: null, name: input.product.name, url: input.product.url };
  }

  private static competitor(input: StageInput, competitor: Competitor): ReviewTarget {
    Trace.line(import.meta.url, "ReviewStage.competitor", { competitorId: competitor.id });
    return { product_id: input.product.id, competitor_id: competitor.id, name: `${competitor.brand} ${competitor.product_name}`, url: competitor.url };
  }
}
