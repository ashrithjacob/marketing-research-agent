import {
  GROUP_SCOPES,
  RELATION_GROUP,
  SOURCE_SCOPES,
  type AnalysedReview,
  type IssueQuote,
  type IssueSlice,
  type MiningTarget,
  type ProductVoice,
  type SourceScope,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { IssueTally } from "./issue-tally.js";

/** Every ranking the cockpit filters between — source (all, Amazon, other sites) by group (main product, direct, indirect) — plus the quotes they cite, each stored once; pure. */
export class IssueSlices {
  constructor(
    private readonly tally: IssueTally,
    private readonly roster: readonly MiningTarget[],
  ) {}

  build(reviews: readonly AnalysedReview[]): { slices: IssueSlice[]; products: ProductVoice[]; quotes: Record<string, IssueQuote> } {
    Trace.line(import.meta.url, "IssueSlices.build", { reviews: reviews.length });
    const relation = new Map<string, string>([["product", "product"], ...this.roster.map((target): [string, string] => [target.id, RELATION_GROUP[target.relation] ?? target.relation])]);
    const slices: IssueSlice[] = [];
    const products: ProductVoice[] = [];
    for (const source of SOURCE_SCOPES) {
      const fromSource = reviews.filter((review) => IssueSlices.inSource(review, source));
      products.push(...this.tally.products(fromSource, this.roster, source));
      for (const group of GROUP_SCOPES) {
        const inGroup = fromSource.filter((review) => relation.get(review.target_id) === group);
        slices.push({ source, group, reviews: inGroup.length, ranked: this.tally.ranked(inGroup) });
      }
    }
    return { slices, products, quotes: IssueSlices.quotes(reviews, slices, products) };
  }

  private static inSource(review: AnalysedReview, source: SourceScope): boolean {
    Trace.tick(import.meta.url, "IssueSlices.inSource", { source });
    return source === "all" || (review.platform === "amazon") === (source === "amazon");
  }

  private static quotes(reviews: readonly AnalysedReview[], slices: readonly IssueSlice[], products: readonly ProductVoice[]): Record<string, IssueQuote> {
    Trace.line(import.meta.url, "IssueSlices.quotes", { slices: slices.length, products: products.length });
    const cited = new Set([
      ...slices.flatMap((slice) => slice.ranked.flatMap((issue) => issue.quotes)),
      ...products.flatMap((product) => product.issues.flatMap((issue) => issue.quotes)),
    ]);
    return Object.fromEntries(reviews.filter((review) => cited.has(review.ref)).map((review) => [review.ref, IssueTally.quote(review)]));
  }
}
