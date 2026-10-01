import { CODE_ID_KINDS, Findings, type Finding, type FindingKind } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** The live rows of one kind as a packet carries them: two rows under one key are one thing, as last recorded, and a kind whose id code assigns gets the row's id. */
export class LatestRows {
  static payloads(live: readonly Finding[], kind: FindingKind): Record<string, unknown>[] {
    Trace.line(import.meta.url, "LatestRows.payloads", { kind });
    const byKey = new Map<string, Finding>();
    for (const row of live.filter((r) => r.kind === kind)) {
      const key = Findings.key(kind, row.payload);
      if (key !== null) byKey.delete(key);
      byKey.set(key ?? row.id, row);
    }
    return [...byKey.values()].map((row) => (CODE_ID_KINDS.has(kind) ? { ...row.payload, id: row.id } : row.payload));
  }
}
