import { Findings, PERSUASION_ELEMENTS, type ElementShare, type Finding } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** A market's sophistication stage, counted from the persuasion elements its competitors' ads were tagged with: the most advanced element at least half the brands use; pure. */
export class SophisticationStage {
  static readonly COMMON = 0.5;

  /** For each element, how many tagged brands use it in at least one ad. */
  static shares(rows: readonly Finding[]): ElementShare[] {
    Trace.line(import.meta.url, "SophisticationStage.shares", { rows: rows.length });
    const byBrand = new Map<string, Set<string>>();
    for (const row of Findings.live(rows).filter((r) => r.kind === "ad_elements")) {
      const brand = String(row.payload.brand ?? "").trim().toLowerCase();
      const elements = Array.isArray(row.payload.elements) ? row.payload.elements.map(String) : [];
      byBrand.set(brand, new Set([...(byBrand.get(brand) ?? []), ...elements]));
    }
    const of = byBrand.size;
    return PERSUASION_ELEMENTS.map((element) => ({ element, brands: [...byBrand.values()].filter((used) => used.has(element)).length, of }));
  }

  /** The stage the tags show, 1 to 5; null when no ad was tagged. */
  static of(rows: readonly Finding[]): number | null {
    Trace.line(import.meta.url, "SophisticationStage.of", { rows: rows.length });
    const shares = SophisticationStage.shares(rows);
    if ((shares[0]?.of ?? 0) === 0) return null;
    const common = shares.map((share, i) => (share.brands / share.of >= SophisticationStage.COMMON ? i + 1 : 0));
    return Math.max(1, ...common);
  }

  /** The counts behind the stage, as the agent and the owner read them. */
  static describe(rows: readonly Finding[]): string {
    Trace.line(import.meta.url, "SophisticationStage.describe");
    return SophisticationStage.shares(rows).map((s) => `${s.element} on ${s.brands} of ${s.of} brands`).join(", ");
  }
}
