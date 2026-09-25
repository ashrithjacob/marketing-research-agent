import { createHash } from "node:crypto";

/** Apify rows are loosely typed; a missing field must read as absent, not crash. */
export class Field {
  static text(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  static numberOrNull(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
}

/** A review's identity on its platform, so the same review fetched twice is stored once. */
export class ReviewKey {
  static of(platformId: string, listing: string, date: string | null, text: string): string {
    if (platformId) return platformId;
    return `sha256:${createHash("sha256").update(`${listing}\n${date ?? ""}\n${text}`).digest("hex")}`;
  }
}
