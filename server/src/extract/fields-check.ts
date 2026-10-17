import { Findings, type FieldSpec, type FieldsDeliverable, type Finding } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { DeliverableCheck, Missing } from "./deliverable-check.js";
import { SophisticationStage } from "./sophistication-stage.js";

/** What a `fields` deliverable still lacks: each required field with no row that fills it and no gap on its node whose `missing` starts with its key. */
export class FieldsCheck implements DeliverableCheck {
  constructor(private readonly deliverable: FieldsDeliverable) {}

  missing(rows: readonly Finding[]): Missing[] {
    Trace.line(import.meta.url, "FieldsCheck.missing", { node: this.deliverable.node, rows: rows.length });
    const mine = Findings.live(rows).filter((row) => this.onNode(row));
    return this.deliverable.fields
      .filter((field) => field.required && !FieldsCheck.gapped(field.key, mine) && !FieldsCheck.filled(field, mine))
      .map((field) => ({ key: field.key, text: FieldsCheck.complaint(field, mine) }));
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
    if (rule.kind === "one_of") return filling.some((row) => FieldsCheck.oneOf(String(row.payload.value ?? ""), rule.values));
    if (rule.kind === "where") return filling.some((row) => String(row.payload[rule.field] ?? "") === rule.value);
    if (rule.kind === "stage_from_elements") return filling.some((row) => FieldsCheck.oneOf(String(row.payload.value ?? ""), [String(SophisticationStage.of(rows))]));
    return typeof filling.at(-1)?.payload[field.key] === "number";
  }

  /** A closed choice of one-word values: the value's first word is one of them, whatever reason follows. */
  static oneOf(value: string, values: readonly string[]): boolean {
    Trace.tick(import.meta.url, "FieldsCheck.oneOf");
    const first = value.trim().toLowerCase().split(/[^a-z0-9]+/)[0] ?? "";
    return values.includes(first);
  }

  private static fills(field: FieldSpec, payload: Record<string, unknown>): boolean {
    Trace.tick(import.meta.url, "FieldsCheck.fills", { record: field.record });
    if (field.record === "attribute") return String(payload.key ?? "").trim() === field.key;
    if (field.record === "measurement") return String(payload.metric ?? "").split(":")[0]!.trim() === field.key;
    return true;
  }

  private static complaint(field: FieldSpec, rows: readonly Finding[]): string {
    Trace.line(import.meta.url, "FieldsCheck.complaint", { key: field.key });
    const gap = `record_gap with missing "${field.key}: <why>"`;
    if (field.rule?.kind === "distinct_periods") return `\`${field.key}\` needs rows for at least ${field.rule.min} different years to be a trend — record them, or ${gap}`;
    if (field.rule?.kind === "stage_from_elements") {
      const stage = SophisticationStage.of(rows);
      if (stage === null) return `\`${field.key}\` is counted from the ads you tagged, and none are tagged: record_ad_elements for each competitor ad or page first, or ${gap}`;
      return `\`${field.key}\` must start with ${stage}: the ads you tagged show ${SophisticationStage.describe(rows)}, and the stage is the most advanced element at least half the brands use — record it so, tag more ads, or ${gap}`;
    }
    if (field.rule?.kind === "where") return `\`${field.key}\` needs at least one row with ${field.rule.field} "${field.rule.value}" — ${field.describe}, or ${gap}`;
    if (field.rule?.kind === "one_of") return `\`${field.key}\` must start with one of ${field.rule.values.map((v) => `"${v}"`).join(", ")}, then why — record it so, or ${gap}`;
    return `\`${field.key}\` is neither recorded nor gapped — ${field.how ?? "record it"}, or ${gap}`;
  }
}
