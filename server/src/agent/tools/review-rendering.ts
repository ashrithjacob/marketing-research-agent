import type { Settings } from "../../config/index.js";
import { Corpus } from "../../adapters/corpus.js";
import type { ReviewResult } from "../../adapters/apify/index.js";

import type { FetchRecord } from "./lanes.js";

/** Turns an Apify review pull into the text the model reads, and archives it verbatim. */
export class ReviewRendering {
  static limit(requested: number | undefined, max: number): number {
    if (requested === undefined || !Number.isFinite(requested)) return max;
    return Math.min(Math.max(Math.trunc(requested), 1), max);
  }

  static cappedNote(requested: number | undefined, limit: number): string {
    if (requested === undefined || Math.trunc(requested) <= limit) return "";
    return (
      `NOTE: asked for ${Math.trunc(requested)} reviews; this server caps each call at ${limit}. ` +
      "Fewer excerpts here does not mean the product has fewer reviews."
    );
  }

  static pullNote(
    requested: number | undefined,
    limit: number,
    pull: { fromLedger: boolean; knownCount: number; fetchedCount: number },
  ): string {
    if (pull.fromLedger) {
      return (
        `NOTE: served from this server's review ledger — an earlier run already pulled these ` +
        "reviews, so nothing was spent on this call."
      );
    }
    const ledgerNote =
      pull.knownCount > 0
        ? `NOTE: ${pull.knownCount} review(s) come from this server's review ledger; Apify was ` +
          `asked for the remaining ${pull.fetchedCount} only. Newest-first ordering means some ` +
          "of those may already be in the ledger; already-known excerpts are shown once, here."
        : "";
    return [ReviewRendering.cappedNote(requested, limit), ledgerNote].filter(Boolean).join("\n");
  }

  static starBand(value: number | undefined): 1 | 2 | 3 | 4 | 5 | null {
    if (value === undefined) return null;
    const n = Math.trunc(value);
    if (n < 1 || n > 5) throw new Error(`star must be between 1 and 5, got ${value}`);
    return n as 1 | 2 | 3 | 4 | 5;
  }

  static locator(locator: string): string {
    return /^https?:\/\//.test(locator)
      ? JSON.stringify({ kind: "url", url: locator })
      : JSON.stringify({ kind: "note", note: `review id ${locator}` });
  }

  static async render(
    settings: Settings,
    runId: string,
    label: string,
    result: ReviewResult,
    onFetch?: (record: FetchRecord) => void,
    note = "",
  ): Promise<{ content: Array<{ type: "text"; text: string }>; details: unknown }> {
    const body = JSON.stringify(result.excerpts, null, 2);
    const { sourceId, archived } = await new Corpus(settings.corpusPath).write(runId, body);

    onFetch?.({
      source_id: sourceId,
      url: label,
      title: `${result.excerpts.length} reviews — ${label}`,
      archived,
      chars: body.length,
      truncated: false,
    });

    const header = [
      `source_id: ${sourceId}`,
      `source: ${label}`,
      `archived: ${archived}`,
      `excerpts: ${result.excerpts.length}`,
      result.totalReviews !== null ? `written_reviews_total: ${result.totalReviews}` : "",
      result.totalRatings !== null ? `ratings_total: ${result.totalRatings}` : "",
      result.gap
        ? `GAP: ${result.gap}\nRecord this as a gap entry. Do NOT substitute a ` +
          "different star band and do not describe the node as complete."
        : "",
      archived
        ? ""
        : "NOTE: the corpus volume could not be written. Record these sources with " +
          "archived: false and add a gap entry saying so.",
      note,
    ]
      .filter(Boolean)
      .join("\n");

    const rendered = result.excerpts.length
      ? result.excerpts
          .map(
            (e, i) =>
              `${i + 1}. [${e.star ?? "?"}*] ${e.date ?? "no date"}` +
              `${e.verified ? " (verified purchase)" : ""}\n` +
              `   title: ${e.title}\n   ${e.text}\n   locator: ${ReviewRendering.locator(e.locator)}`,
          )
          .join("\n\n")
      : "(no excerpts)";

    return {
      content: [{ type: "text", text: `${header}\n\n---\n\n${rendered}` }],
      details: { source_id: sourceId, archived, ...result },
    };
  }
}
