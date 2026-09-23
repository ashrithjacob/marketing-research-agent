/** Apify rows are loosely typed; a missing field must read as absent, not crash. */
export class Field {
  static text(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  static numberOrNull(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
}
