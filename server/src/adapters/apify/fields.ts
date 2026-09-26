import { createHash } from "node:crypto";
import { Trace } from "../../trace/index.js";

/** Apify rows are loosely typed; a missing field must read as absent, not crash. */
export class Field {
  static text(value: unknown): string {
    Trace.line(import.meta.url, "Field.text", { value });
    return typeof value === "string" ? value : "";
  }

  static numberOrNull(value: unknown): number | null {
    Trace.line(import.meta.url, "Field.numberOrNull", { value });
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
}

/** A review's identity on its platform, so the same review fetched twice is stored once. */
export class ReviewKey {
  static of(platformId: string, listing: string, date: string | null, text: string): string {
    Trace.line(import.meta.url, "ReviewKey.of", { platformId, listing, date, text });
    if (platformId) return platformId;
    return `sha256:${createHash("sha256").update(`${listing}\n${date ?? ""}\n${text}`).digest("hex")}`;
  }
}
