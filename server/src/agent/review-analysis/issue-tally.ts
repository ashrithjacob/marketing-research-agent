import type {
  AnalysedReview,
  Issue,
  IssueQuote,
  MiningTarget,
  ProductIssue,
  ProductVoice,
  RankedIssue,
  ReviewTag,
  SourceScope,
  StarWeights,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

interface Mention {
  review: AnalysedReview;
  weight: number;
}

/** Turns tagged reviews into ranked issues per product and overall; pure. */
export class IssueTally {
  static readonly STAR_WEIGHTS: StarWeights = { 1: 1, 2: 1.5, 3: 2, 4: 1.5, 5: 1 };
  static readonly QUOTES = 4;
  static readonly QUOTE_CHARS = 600;

  private readonly kinds: ReadonlyMap<string, Issue["kind"]>;

  constructor(
    private readonly issues: readonly Issue[],
    private readonly tags: ReadonlyMap<string, ReviewTag>,
  ) {
    Trace.line(import.meta.url, "IssueTally.constructor", { issues: issues.length, tags: tags.size });
    this.kinds = new Map(issues.map((issue) => [issue.id, issue.kind]));
  }

  products(reviews: readonly AnalysedReview[], roster: readonly MiningTarget[], source: SourceScope): ProductVoice[] {
    Trace.line(import.meta.url, "IssueTally.products", { reviews: reviews.length, roster: roster.length, source });
    const ids = [...new Set([...roster.map((target) => target.id), ...reviews.map((review) => review.target_id)])];
    return ids
      .map((id) => ({ id, own: reviews.filter((review) => review.target_id === id), target: roster.find((t) => t.id === id) }))
      .filter(({ own }) => own.length > 0)
      .map(({ id, own, target }) => {
        const issues = this.rank(own);
        const complaints = issues.filter((i) => this.kinds.get(i.issue_id) !== "praise").reduce((sum, i) => sum + i.mentions, 0);
        return {
          source,
          target_id: id,
          name: target?.name ?? id,
          relation: target?.relation ?? "",
          reviews: own.length,
          stars: IssueTally.stars(own),
          complaints,
          issues: issues.map((issue) => ({
            ...issue,
            share: this.kinds.get(issue.issue_id) === "praise" ? issue.mentions / own.length : complaints > 0 ? issue.mentions / complaints : 0,
          })),
        };
      });
  }

  ranked(reviews: readonly AnalysedReview[]): RankedIssue[] {
    Trace.line(import.meta.url, "IssueTally.ranked", { reviews: reviews.length });
    return this.rank(reviews).map(({ share: _share, ...rest }) => rest);
  }

  private rank(reviews: readonly AnalysedReview[]): ProductIssue[] {
    Trace.line(import.meta.url, "IssueTally.rank", { reviews: reviews.length });
    const mentions = new Map<string, Mention[]>();
    for (const review of reviews) {
      const tag = this.tags.get(review.ref);
      if (!tag) continue;
      for (const id of new Set(tag.issues)) {
        const kind = this.kinds.get(id);
        if (!kind) continue;
        const severity = kind === "praise" ? 1 : tag.severity;
        mentions.set(id, [...(mentions.get(id) ?? []), { review, weight: IssueTally.weight(review.star) * severity }]);
      }
    }
    return [...mentions.entries()]
      .map(([issue_id, list]) => ({
        issue_id,
        mentions: list.length,
        share: 0,
        score: Number(list.reduce((sum, m) => sum + m.weight, 0).toFixed(2)),
        quotes: IssueTally.quotes(list),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private static quotes(list: readonly Mention[]): string[] {
    Trace.line(import.meta.url, "IssueTally.quotes", { mentions: list.length });
    return [...list]
      .sort((a, b) => Number(b.review.star === 3) - Number(a.review.star === 3) || b.weight - a.weight || IssueTally.readable(b.review) - IssueTally.readable(a.review))
      .slice(0, IssueTally.QUOTES)
      .map(({ review }) => review.ref);
  }

  static quote(review: AnalysedReview): IssueQuote {
    Trace.tick(import.meta.url, "IssueTally.quote", {});
    return {
      ref: review.ref,
      star: review.star,
      title: review.title,
      text: review.text.slice(0, IssueTally.QUOTE_CHARS),
      platform: review.platform,
      locator: review.locator,
    };
  }

  private static readable(review: AnalysedReview): number {
    Trace.tick(import.meta.url, "IssueTally.readable", {});
    return -Math.abs(review.text.length - 220);
  }

  static weight(star: number | null): number {
    Trace.tick(import.meta.url, "IssueTally.weight", {});
    return star !== null && star >= 1 && star <= 5 ? IssueTally.STAR_WEIGHTS[star as 1 | 2 | 3 | 4 | 5] : 1;
  }

  private static stars(reviews: readonly AnalysedReview[]): [number, number, number, number, number] {
    Trace.line(import.meta.url, "IssueTally.stars", { reviews: reviews.length });
    const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const review of reviews) {
      if (review.star !== null && review.star >= 1 && review.star <= 5) counts[review.star - 1]! += 1;
    }
    return counts;
  }
}
