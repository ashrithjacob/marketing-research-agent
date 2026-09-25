import type { ReviewPlatform } from "../../domain/index.js";
import { Clock } from "../../domain/index.js";
import type { Settings } from "../../config/index.js";
import { Corpus } from "../../adapters/corpus.js";
import type { ReviewResult } from "../../adapters/apify/index.js";

import type { ReviewLedger } from "../review-ledger.js";

import type { FetchRecord } from "./lanes.js";

export interface PullLabel {
  target_id: string;
  platform: ReviewPlatform;
  listing: string;
  band: 1 | 2 | 3 | 4 | 5 | null;
}

/** Archives a review pull verbatim, files it in the ledger, and tells the model what arrived — never the text. */
export class ReviewRendering {
  constructor(
    private readonly settings: Settings,
    private readonly runId: string,
    private readonly ledger: ReviewLedger,
    private readonly onFetch?: (record: FetchRecord) => void,
  ) {}

  static limit(requested: number | undefined, max: number): number {
    if (requested === undefined || !Number.isFinite(requested)) return max;
    return Math.min(Math.max(Math.trunc(requested), 1), max);
  }

  static cappedNote(requested: number | undefined, limit: number): string {
    if (requested === undefined || Math.trunc(requested) <= limit) return "";
    return (
      `NOTE: asked for ${Math.trunc(requested)} reviews; this server caps each call at ${limit}. ` +
      "Fewer reviews here does not mean the product has fewer reviews."
    );
  }

  static starBand(value: number | undefined): 1 | 2 | 3 | 4 | 5 | null {
    if (value === undefined) return null;
    const n = Math.trunc(value);
    if (n < 1 || n > 5) throw new Error(`star must be between 1 and 5, got ${value}`);
    return n as 1 | 2 | 3 | 4 | 5;
  }

  async render(
    label: PullLabel,
    result: ReviewResult,
    note = "",
  ): Promise<{ text: string; details: unknown }> {
    const body = JSON.stringify(result.excerpts, null, 2);
    const { sourceId, archived } = await new Corpus(this.settings.corpusPath).write(this.runId, body);
    this.onFetch?.({
      source_id: sourceId,
      url: label.listing,
      title: `${result.excerpts.length} reviews — ${label.listing}`,
      archived,
      chars: body.length,
      truncated: false,
    });
    const filed = this.ledger.record(
      {
        source_id: sourceId,
        target_id: label.target_id,
        platform: label.platform,
        listing: label.listing,
        band_requested: label.band,
        fetched_at: Clock.nowIso(),
        archived,
        total_reviews: result.totalReviews,
        total_ratings: result.totalRatings,
        gap: result.gap,
      },
      result.excerpts,
    );

    const text = [
      `pull: ${filed.handle}   (cite it as source_id "${filed.handle}")`,
      `source: ${label.listing}`,
      `archived: ${archived}`,
      `reviews: ${filed.added.length} new${filed.repeats ? `, ${filed.repeats} already in the ledger` : ""}` +
        ReviewRendering.spread(filed.added.map((review) => review.star)),
      result.totalReviews !== null ? `written_reviews_total: ${result.totalReviews}` : "",
      result.totalRatings !== null ? `ratings_total: ${result.totalRatings}` : "",
      result.offBand > 0
        ? `NOTE: ${result.offBand} came back rated other than ${label.band}-star; each is filed ` +
          "under its own rating."
        : "",
      result.gap
        ? `GAP: ${result.gap}\nRecord this as a gap entry. Do NOT substitute a ` +
          "different star band and do not describe the node as complete."
        : "",
      archived
        ? ""
        : "NOTE: the corpus volume could not be written. Add a gap entry saying so.",
      note,
    ]
      .filter(Boolean)
      .join("\n");

    return { text, details: { handle: filed.handle, source_id: sourceId, archived, ...result } };
  }

  footer(): string {
    return (
      `LEDGER: ${this.ledger.size()} reviews held for this run. The server adds every one to ` +
      "the packet, verbatim, with its pull as the source. Never copy a review into the packet, " +
      "and do not list review pulls in sources: cite a pull by its handle."
    );
  }

  private static spread(stars: ReadonlyArray<number | null>): string {
    if (stars.length === 0) return "";
    const counts = new Map<string, number>();
    for (const star of stars) {
      const key = star === null ? "?" : String(star);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const parts = [...counts.entries()].sort().map(([star, n]) => `${star}* ${n}`);
    return ` (${parts.join(", ")})`;
  }
}
