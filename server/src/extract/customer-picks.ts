import { Findings, type Finding, type FindingKind } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** A customer-truth row that cites quotes or an avatar must cite ones the ledger holds; checked when it is written, so an invented id is refused on the turn it is made. */
export class CustomerPicks {
  static problems(kind: FindingKind, payload: Record<string, unknown>, live: readonly Finding[]): string[] {
    Trace.line(import.meta.url, "CustomerPicks.problems", { kind });
    const quotes = CustomerPicks.missingQuotes(payload, live);
    if (kind === "avatar") return [...quotes, ...CustomerPicks.parent(payload, live)];
    if (kind === "awareness") return [...quotes, ...CustomerPicks.avatar(String(payload.avatar_id ?? ""), live)];
    return quotes;
  }

  private static missingQuotes(payload: Record<string, unknown>, live: readonly Finding[]): string[] {
    Trace.line(import.meta.url, "CustomerPicks.missingQuotes");
    const held = new Set(live.filter((row) => row.kind === "quote").map((row) => row.id));
    const cited = Array.isArray(payload.quote_ids) ? payload.quote_ids.map(String) : [];
    const missing = cited.filter((id) => !held.has(id));
    return missing.length === 0 ? [] : [`no quote with id ${missing.join(", ")} in the ledger; cite the qt… ids record_quote returned, or read_ledger to see them`];
  }

  private static parent(payload: Record<string, unknown>, live: readonly Finding[]): string[] {
    Trace.line(import.meta.url, "CustomerPicks.parent");
    const parent = payload.parent;
    if (parent === null || parent === undefined || parent === "") return [];
    return CustomerPicks.avatar(String(parent), live);
  }

  private static avatar(id: string, live: readonly Finding[]): string[] {
    Trace.line(import.meta.url, "CustomerPicks.avatar", { id });
    const ids = Findings.live(live).filter((row) => row.kind === "avatar").map((row) => String(row.payload.id ?? ""));
    if (ids.includes(id)) return [];
    return [`'${id}' is not a recorded avatar; use one of: ${ids.join(", ") || "none yet"}`];
  }
}
