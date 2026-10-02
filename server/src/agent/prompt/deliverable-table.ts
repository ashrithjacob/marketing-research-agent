import type { FieldRule, FieldSpec, FieldsDeliverable } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** A `fields` deliverable as the prompt's table: the compulsory fields first, then the optional ones under their own heading, each with what to record and any rule it must meet. */
export class DeliverableTable {
  static render(deliverable: FieldsDeliverable): string {
    Trace.line(import.meta.url, "DeliverableTable.render", { node: deliverable.node });
    const required = deliverable.fields.filter((field) => field.required);
    const optional = deliverable.fields.filter((field) => !field.required);
    const tables = [DeliverableTable.table(required)];
    if (optional.length > 0) tables.push(`May also be recorded:\n\n${DeliverableTable.table(optional)}`);
    return tables.join("\n\n");
  }

  private static table(fields: readonly FieldSpec[]): string {
    Trace.line(import.meta.url, "DeliverableTable.table", { fields: fields.length });
    const rows = fields.map((field) => `| \`${field.key}\` | ${[field.describe, ...DeliverableTable.rule(field.rule)].join(" ")} |`);
    return ["| field | what to record |", "|---|---|", ...rows].join("\n");
  }

  private static rule(rule: FieldRule | undefined): string[] {
    Trace.line(import.meta.url, "DeliverableTable.rule", { rule: rule?.kind });
    if (rule?.kind === "distinct_periods") return [`Rows for **at least ${rule.min} different years** make the trend.`];
    if (rule?.kind === "number_on_latest") return ["As a number."];
    return [];
  }
}
