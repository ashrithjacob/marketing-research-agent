import { Type, type TSchema, type Tool } from "@earendil-works/pi-ai";

import { ISSUE_KINDS, type AnalysedReview, type Issue } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** The two prompts a review analysis sends: build the issue catalogue, then tag reviews against it. */
export class AnalysisPrompts {
  static readonly CATALOG_CHARS = 400;
  static readonly TAG_CHARS = 700;

  static readonly catalogTool: Tool<TSchema> = {
    name: "record_issue_catalogue",
    description: "Record the catalogue of issues found across these reviews.",
    constrainedSampling: { type: "json_schema", strict: "prefer" },
    parameters: Type.Object({
      issues: Type.Array(
        Type.Object({
          id: Type.String({ description: "snake_case id, e.g. capsule_too_large" }),
          label: Type.String({ description: "Two to five plain words, e.g. 'Capsule too large'" }),
          kind: Type.Union(ISSUE_KINDS.map((kind) => Type.Literal(kind))),
          description: Type.String({ description: "One sentence: what a review must say to count." }),
        }),
      ),
    }),
  };

  static readonly tagTool: Tool<TSchema> = {
    name: "record_review_tags",
    description: "Record which catalogue issues each review raises.",
    constrainedSampling: { type: "json_schema", strict: "prefer" },
    parameters: Type.Object({
      tags: Type.Array(
        Type.Object({
          n: Type.Integer({ description: "The review's number, from #n." }),
          issues: Type.Array(Type.String(), { description: "Catalogue ids this review raises." }),
          severity: Type.Integer({ minimum: 1, maximum: 3 }),
          off_product: Type.Boolean(),
          new_label: Type.String({ description: "Two to five words for a real point no catalogue id covers; empty string when none." }),
          new_kind: Type.Union(ISSUE_KINDS.map((kind) => Type.Literal(kind)), { description: "The kind of new_label; ignored when new_label is empty." }),
        }),
      ),
    }),
  };

  static catalogSystem(): string {
    Trace.line(import.meta.url, "AnalysisPrompts.catalogSystem");
    return [
      "You analyse customer reviews for a product researcher. Build one catalogue of issues that",
      "applies across every product in the set, so products can be compared issue by issue.",
      "",
      "- complaint: something that went wrong or disappointed (side effect, no effect felt, pill size, taste, packaging, price, fake or damaged item).",
      "- request: something customers ask for or wish were different (a smaller pill, a bigger bottle, a liquid form).",
      "- praise: something customers value (easy to swallow, results felt, good value).",
      "",
      "Every 3-star review comes first and carries the most weight: those reviewers name the trade-offs",
      "precisely. Read them before the rest.",
      "",
      "Make each issue concrete enough that two readers would tag the same review the same way:",
      "'Capsule too large to swallow', never 'Quality'. Return 10 to 18 complaints and requests and",
      "4 to 8 praises. Merge near-duplicates. Do not invent an issue no review raises.",
    ].join("\n");
  }

  static catalogUser(subject: string, reviews: readonly AnalysedReview[]): string {
    Trace.line(import.meta.url, "AnalysisPrompts.catalogUser", { subject, reviews: reviews.length });
    return [`Product researched: ${subject}`, "", ...reviews.map((review) => AnalysisPrompts.line(review, AnalysisPrompts.CATALOG_CHARS))].join("\n");
  }

  static tagSystem(issues: readonly Issue[]): string {
    Trace.line(import.meta.url, "AnalysisPrompts.tagSystem", { issues: issues.length });
    return [
      "Tag customer reviews against this issue catalogue. Use only these ids.",
      "",
      ...issues.map((issue) => `- ${issue.id} (${issue.kind}): ${issue.label} — ${issue.description}`),
      "",
      "Return one tag for every review that raises at least one catalogue issue, raises a real point",
      "the catalogue misses, or is about a different product entirely. Leave out reviews that say nothing",
      "specific (\"works fine\", \"arrived on time\").",
      "- new_label: when the review makes a concrete point no catalogue id covers, name it in two to five",
      "  words (e.g. 'Smells fishy'), and set new_kind. Never use it for something a catalogue id covers.",
      "  Empty string otherwise.",
      "- issues: every catalogue id the review raises; [] when off_product and nothing else applies.",
      "- severity of the worst complaint: 1 a minor annoyance, 2 a real problem that affects use or",
      "  repurchase, 3 serious — a health reaction, a safety worry, a fake or damaged item, a refund.",
      "  Use 1 when the review only praises or requests.",
      "- off_product: true only when the review describes a different product from the one listed",
      "  (another brand, another item that was shipped, another listing's product).",
    ].join("\n");
  }

  static tagUser(reviews: readonly AnalysedReview[], names: ReadonlyMap<string, string>): string {
    Trace.line(import.meta.url, "AnalysisPrompts.tagUser", { reviews: reviews.length });
    return reviews
      .map((review, index) => `#${index} [listed as: ${names.get(review.target_id) ?? review.target_id}] ${AnalysisPrompts.line(review, AnalysisPrompts.TAG_CHARS)}`)
      .join("\n");
  }

  private static line(review: AnalysedReview, chars: number): string {
    Trace.tick(import.meta.url, "AnalysisPrompts.line", {});
    const star = review.star === null ? "?" : String(review.star);
    const body = `${review.title} — ${review.text}`.replace(/\s+/g, " ").slice(0, chars);
    return `[${star}★ ${review.target_id}] ${body}`;
  }
}
