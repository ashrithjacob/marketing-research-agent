import type { Finding, FindingKind } from "./findings.js";
import type { Node } from "./nodes.js";
import { PRODUCT_ATTRIBUTES } from "./vocabulary.js";
import { Trace } from "../trace/index.js";

export const CATEGORY_MEASUREMENTS = ["search_volume", "category_size"] as const;
export const CATEGORY_ATTRIBUTES = ["seasonality"] as const;
export const TREND_YEARS = 3;

export interface NodeFieldSet {
  attributes: readonly string[];
  measurements: readonly string[];
}

const FIELDS: Partial<Record<Node, NodeFieldSet>> = {
  product_data: { attributes: PRODUCT_ATTRIBUTES, measurements: [] },
  category_data: { attributes: CATEGORY_ATTRIBUTES, measurements: CATEGORY_MEASUREMENTS },
};

/** The fields a checklist node must fill — it may record others too — and which of them are still neither recorded nor gapped. */
export class NodeFields {
  static of(node: Node): NodeFieldSet | null {
    Trace.line(import.meta.url, "NodeFields.of", { node });
    return FIELDS[node] ?? null;
  }

  static all(node: Node): string[] {
    Trace.line(import.meta.url, "NodeFields.all", { node });
    const set = NodeFields.of(node);
    return set ? [...set.attributes, ...set.measurements] : [];
  }

  /** The field a row fills: an attribute's key, or a measurement's metric before any ": <segment>". */
  static fieldOf(kind: FindingKind, payload: Record<string, unknown>): string | null {
    Trace.tick(import.meta.url, "NodeFields.fieldOf", { kind });
    if (kind === "attribute") return String(payload.key ?? "").trim();
    if (kind === "measurement") return String(payload.metric ?? "").split(":")[0]!.trim();
    return null;
  }

  /** Every field with no live row and no gap naming it; search_volume also needs three distinct years to be a trend. */
  static missing(node: Node, rows: readonly Finding[]): string[] {
    Trace.line(import.meta.url, "NodeFields.missing", { node, rows: rows.length });
    const mine = rows.filter((row) => row.payload.node === node);
    const gapped = (field: string) =>
      mine.some((row) => row.kind === "gap" && String(row.payload.missing ?? "").trim().toLowerCase().startsWith(field));
    const filled = (field: string) => mine.filter((row) => NodeFields.fieldOf(row.kind, row.payload) === field);
    return NodeFields.all(node).filter((field) => {
      if (gapped(field)) return false;
      const found = filled(field);
      if (field !== "search_volume") return found.length === 0;
      return new Set(found.map((row) => String(row.payload.period ?? "").slice(0, 4))).size < TREND_YEARS;
    });
  }
}
