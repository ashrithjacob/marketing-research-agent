import { Findings, type FieldSpec, type FieldsDeliverable, type Finding } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { DeliverableCheck, Missing } from "./deliverable-check.js";

/** What a `fields` deliverable still lacks: each required field with no row that fills it and no gap on its node whose `missing` starts with its key. */
export class FieldsCheck implements DeliverableCheck {
  constructor(private readonly deliverable: FieldsDeliverable) {}

  missing(rows: readonly Finding[]): Missing[] {
    Trace.line(import.meta.url, "FieldsCheck.missing", { node: this.deliverable.node, rows: rows.length });
    const mine = Findings.live(rows).filter((row) => this.onNode(row));
    return this.deliverable.fields
      .filter((field) => field.required && !FieldsCheck.gapped(field.key, mine) && !FieldsCheck.filled(field, mine))
      .map((field) => ({ key: field.key, text: FieldsCheck.complaint(field) }));
  }

  /** A row with a `node` counts only on this deliverable's node; a kind with none (an active, a regimen) counts wherever it is. */
  private onNode(row: Finding): boolean {
    Trace.tick(import.meta.url, "FieldsCheck.onNode");
    const node = this.deliverable.node;
    return node === null || typeof row.payload.node !== "string" || row.payload.node === node;
  }

  static gapped(key: string, rows: readonly Finding[]): boolean {
    Trace.line(import.meta.url, "FieldsCheck.gapped", { key });
    const wanted = key.toLowerCase();
    return rows.some((row) => row.kind === "gap" && String(row.payload.missing ?? "").trim().toLowerCase().startsWith(wanted));
  }

  /** An attribute fills its key, a measurement its metric before any ": <segment>", any other kind by having a row; a rule then asks more of those rows. */
  private static filled(field: FieldSpec, rows: readonly Finding[]): boolean {
    Trace.line(import.meta.url, "FieldsCheck.filled", { key: field.key });
    const filling = rows.filter((row) => row.kind === field.record && FieldsCheck.fills(field, row.payload));
    const rule = field.rule;
    if (!rule) return filling.length > 0;
    if (rule.kind === "distinct_periods") return new Set(filling.map((row) => String(row.payload.period ?? "").slice(0, 4))).size >= rule.min;
    return typeof filling.at(-1)?.payload[field.key] === "number";
  }

  private static fills(field: FieldSpec, payload: Record<string, unknown>): boolean {
    Trace.tick(import.meta.url, "FieldsCheck.fills", { record: field.record });
    if (field.record === "attribute") return String(payload.key ?? "").trim() === field.key;
    if (field.record === "measurement") return String(payload.metric ?? "").split(":")[0]!.trim() === field.key;
    return true;
  }

  private static complaint(field: FieldSpec): string {
    Trace.line(import.meta.url, "FieldsCheck.complaint", { key: field.key });
    const gap = `record_gap with missing "${field.key}: <why>"`;
    if (field.rule?.kind === "distinct_periods") return `\`${field.key}\` needs rows for at least ${field.rule.min} different years to be a trend — record them, or ${gap}`;
    return `\`${field.key}\` is neither recorded nor gapped — record it, or ${gap}`;
  }
}
