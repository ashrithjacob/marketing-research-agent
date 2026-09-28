import type { Usage } from "@earendil-works/pi-ai";

import { Http } from "../../adapters/index.js";
import {
  issueCatalogSchema,
  reviewTagsSchema,
  type AnalysedReview,
  type MiningTarget,
  type ReviewAnalysis,
  type ReviewTag,
  type StoredRunReview,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { AnalysisPrompts } from "./analysis-prompts.js";
import { IssueSlices } from "./issue-slices.js";
import { IssueTally } from "./issue-tally.js";
import { NewIssueMerge } from "./new-issue-merge.js";
import { ReviewCleaner } from "./review-cleaner.js";
import { ReviewSample } from "./review-sample.js";
import type { StructuredAsk } from "./structured-ask.js";

export type AnalysisFindings = Pick<ReviewAnalysis, "cleaning" | "issues" | "slices" | "products" | "quotes">;

/** Cleans a run's reviews, builds one issue catalogue from a 3-star-first sample, tags every review in bulk batches, and tallies. */
export class ReviewAnalysisJob {
  static readonly BATCH = 50;
  static readonly CONCURRENCY = 8;

  constructor(private readonly asker: StructuredAsk) {}

  async run(
    input: { subject: string; reviews: readonly StoredRunReview[]; roster: readonly MiningTarget[] },
    onUsage: (usage: Usage) => void,
  ): Promise<AnalysisFindings> {
    Trace.line(import.meta.url, "ReviewAnalysisJob.run", { subject: input.subject, reviews: input.reviews.length });
    const cleaned = ReviewCleaner.clean(input.reviews);
    const catalog = await this.asker.ask(
      {
        system: AnalysisPrompts.catalogSystem(),
        user: AnalysisPrompts.catalogUser(input.subject, ReviewSample.forCatalog(cleaned.kept)),
        tool: AnalysisPrompts.catalogTool,
        schema: issueCatalogSchema,
      },
      onUsage,
    );
    const names = new Map(input.roster.map((target) => [target.id, target.name]));
    const tagged = await this.tag(cleaned.kept, catalog.issues, names, onUsage);
    const { issues, tags } = await new NewIssueMerge(this.asker).apply(catalog.issues, tagged.tags, onUsage);
    const untagged = tagged.untagged;
    const read = cleaned.kept.filter((review) => !untagged.has(review.ref));
    const kept = read.filter((review) => !tags.get(review.ref)?.off_product);
    const sliced = new IssueSlices(new IssueTally(issues, tags), input.roster).build(kept);
    return {
      cleaning: {
        fetched: input.reviews.length,
        duplicates: cleaned.duplicates,
        empty: cleaned.empty,
        off_product: read.length - kept.length,
        untagged: untagged.size,
        kept: kept.length,
      },
      issues,
      ...sliced,
    };
  }

  private async tag(
    reviews: readonly AnalysedReview[],
    issues: ReviewAnalysis["issues"],
    names: ReadonlyMap<string, string>,
    onUsage: (usage: Usage) => void,
  ): Promise<{ tags: Map<string, ReviewTag>; untagged: Set<string> }> {
    Trace.line(import.meta.url, "ReviewAnalysisJob.tag", { reviews: reviews.length, issues: issues.length });
    const system = AnalysisPrompts.tagSystem(issues);
    const batches = ReviewSample.batches(reviews, ReviewAnalysisJob.BATCH);
    const answers = await Http.pool(batches, ReviewAnalysisJob.CONCURRENCY, (batch) =>
      this.asker
        .ask(
          { system, user: AnalysisPrompts.tagUser(batch, names), tool: AnalysisPrompts.tagTool, schema: reviewTagsSchema },
          onUsage,
        )
        .catch(() => null),
    );
    const tags = new Map<string, ReviewTag>();
    const untagged = new Set<string>();
    answers.forEach((answer, index) => {
      const batch = batches[index]!;
      if (!answer) batch.forEach((review) => untagged.add(review.ref));
      for (const tag of answer?.tags ?? []) {
        const review = batch[tag.n];
        if (review) tags.set(review.ref, tag);
      }
    });
    return { tags, untagged };
  }
}
