import type { ReviewExcerpt } from "./types.js";

/** Files every written review under its own rating; a row off the band asked for is kept, and counted. */
export class BandFiling {
  static file(
    rows: readonly ReviewExcerpt[],
    star: 1 | 2 | 3 | 4 | 5 | null,
    label: string,
  ): { excerpts: ReviewExcerpt[]; offBand: number; gap: string | null } {
    const offBand = star === null ? 0 : rows.filter((row) => row.star !== star).length;
    const bandEmpty = star !== null && rows.length > 0 && offBand === rows.length;
    return {
      excerpts: [...rows],
      offBand,
      gap: bandEmpty
        ? `Asked ${label} for ${star}-star reviews and none came back at that rating; ` +
          `the ${rows.length} that did are kept under their own rating.`
        : null,
    };
  }
}
