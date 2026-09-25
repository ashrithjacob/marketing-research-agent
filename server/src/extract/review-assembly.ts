import type {
  Excerpt,
  LedgerPull,
  LedgerReview,
  ReviewLedgerSnapshot,
  Source,
} from "../domain/index.js";

type Draft = Record<string, unknown>;
type Row = Record<string, unknown>;

/** Builds the review half of a packet from the ledger, so no review is ever copied by the model. */
export class ReviewAssembly {
  private readonly pulls: ReadonlyMap<string, LedgerPull>;

  constructor(private readonly ledger: ReviewLedgerSnapshot) {
    this.pulls = new Map(ledger.pulls.map((pull) => [pull.handle, pull]));
  }

  expand(draft: Draft): Draft {
    if (this.ledger.pulls.length === 0) return draft;
    return {
      ...draft,
      sources: ReviewAssembly.merge(draft.sources ?? [], this.sources()),
      excerpts: ReviewAssembly.merge(draft.excerpts ?? [], this.excerpts()),
      measurements: this.resolveAll(draft.measurements),
      attributes: this.resolveAll(draft.attributes),
      saturation: Array.isArray(draft.saturation)
        ? draft.saturation.map((entry) =>
            ReviewAssembly.isRow(entry) ? { ...entry, curve: this.resolveAll(entry.curve) } : entry,
          )
        : draft.saturation,
    };
  }

  private resolveAll(value: unknown): unknown {
    if (!Array.isArray(value)) return value;
    return value.map((item) => (ReviewAssembly.isRow(item) ? this.resolve(item) : item));
  }

  private static isRow(value: unknown): value is Row {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  private resolve(row: Row): Row {
    const handle = row.source_id;
    const pull = typeof handle === "string" ? this.pulls.get(handle) : undefined;
    return pull ? { ...row, source_id: pull.source_id } : row;
  }

  private sources(): Source[] {
    return this.ledger.pulls.map((pull) => ({
      id: pull.source_id,
      url: pull.listing,
      title: ReviewAssembly.title(pull),
      kind: pull.platform === "amazon" ? "marketplace_review" : "review_platform",
      publisher: ReviewAssembly.publisher(pull),
      fetched_at: pull.fetched_at,
      first_seen: null,
      marketing: false,
      admitted: true,
      admission_reason: `${pull.platform} reviews — fetched and archived by the review tools`,
      archived: pull.archived,
      node: "review_mining",
    }));
  }

  private excerpts(): Excerpt[] {
    return this.ledger.reviews.flatMap((review) => {
      const pull = this.pulls.get(review.pull);
      if (!pull) return [];
      return [
        {
          id: review.ref,
          source_id: pull.source_id,
          text: review.text,
          locator: ReviewAssembly.locator(review),
          captured_at: pull.fetched_at,
          node: "review_mining",
          star_rating: ReviewAssembly.star(review.star),
          posted_at: review.posted_at,
          axis: null,
          themes: [],
        },
      ];
    });
  }

  private static merge(drafted: unknown, built: ReadonlyArray<Source | Excerpt>): unknown {
    if (!Array.isArray(drafted)) return drafted;
    const ids = new Set(built.map((item) => item.id));
    const kept = drafted.filter((row) => !(ReviewAssembly.isRow(row) && ids.has(row.id as string)));
    const unique = new Map(built.map((item) => [item.id, item as unknown as Row]));
    return [...kept, ...unique.values()];
  }

  private static title(pull: LedgerPull): string {
    const band = pull.band_requested === null ? "all ratings" : `${pull.band_requested}-star pull`;
    return `${pull.target_id} — ${pull.platform} reviews, ${band} — ${pull.listing}`;
  }

  private static publisher(pull: LedgerPull): string {
    if (pull.platform === "trustpilot") return "trustpilot.com";
    try {
      return new URL(pull.listing).hostname.replace(/^www\./, "");
    } catch {
      return "amazon";
    }
  }

  private static locator(review: LedgerReview): Excerpt["locator"] {
    const base = { start: null, end: null, url: "", selector: "", note: "" };
    if (/^https?:\/\//.test(review.locator)) return { ...base, kind: "url", url: review.locator };
    return { ...base, kind: "note", note: `review id ${review.locator || review.review_key}` };
  }

  private static star(star: number | null): number | null {
    return star !== null && Number.isInteger(star) && star >= 1 && star <= 5 ? star : null;
  }
}
