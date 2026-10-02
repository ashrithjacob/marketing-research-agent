import { Findings, type Finding, type ListDeliverable } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { DeliverableCheck, Missing } from "./deliverable-check.js";
import { FieldsCheck } from "./fields-check.js";
import { LatestRows } from "./latest-rows.js";

/** What a `list` deliverable still lacks: an item with a required part empty, or a class whose saturation curve does not end in the stop rule's run of sources adding nothing, and no gap naming it. */
export class ListCheck implements DeliverableCheck {
  constructor(private readonly deliverable: ListDeliverable) {}

  missing(rows: readonly Finding[]): Missing[] {
    Trace.line(import.meta.url, "ListCheck.missing", { node: this.deliverable.node, rows: rows.length });
    const mine = Findings.live(rows).filter((row) => typeof row.payload.node !== "string" || row.payload.node === this.deliverable.node);
    const items = LatestRows.rows(mine, this.deliverable.item).flatMap((row) =>
      ListCheck.parts(this.deliverable, row.payload).map((text) => ({ key: `${row.kind} ${String(row.payload.id ?? row.id)}`, text, row: { kind: row.kind, key: Findings.identity(row.kind, row.payload, row.id) } })),
    );
    return [...items, ...this.unsaturated(mine)];
  }

  /** Each required part an item leaves empty, as the agent should read it when the row is written. */
  static parts(deliverable: ListDeliverable, payload: Record<string, unknown>): string[] {
    Trace.line(import.meta.url, "ListCheck.parts", { id: payload.id });
    const label = `${deliverable.item} '${String(payload.name ?? payload.id ?? "")}'`;
    return deliverable.parts
      .filter((part) => part.required && !String(payload[part.key] ?? "").trim())
      .map((part) => `${label} has no ${part.key} — record ${part.describe}`);
  }

  private unsaturated(rows: readonly Finding[]): Missing[] {
    Trace.line(import.meta.url, "ListCheck.unsaturated", { classes: this.deliverable.classes });
    const { classes, stop } = this.deliverable;
    const curves = LatestRows.payloads(rows, "saturation");
    return classes.flatMap((cls) => {
      const key = `saturation: ${cls}`;
      if (FieldsCheck.gapped(key, rows)) return [];
      const curve = (curves.find((c) => c.class === cls)?.curve as Array<{ new_themes?: number }> | undefined) ?? [];
      const quiet = ListCheck.quietRun(curve);
      if (quiet >= stop.quietRun) return [];
      const gap = `record_gap with missing "${key}: <why>"`;
      const text = curve.length === 0
        ? `no ${cls} saturation curve is recorded — record_saturation for class "${cls}", or ${gap}`
        : `the ${cls} curve ends in ${quiet} source${quiet === 1 ? "" : "s"} in a row adding nothing; it is saturated after ${stop.quietRun} — keep looking, or ${gap}`;
      return [{ key, text }];
    });
  }

  /** How many sources at the end of a curve added nothing, in a row. */
  private static quietRun(curve: ReadonlyArray<{ new_themes?: number }>): number {
    Trace.line(import.meta.url, "ListCheck.quietRun", { points: curve.length });
    let quiet = 0;
    for (let i = curve.length - 1; i >= 0 && curve[i]!.new_themes === 0; i -= 1) quiet += 1;
    return quiet;
  }
}
