import type { FindingKind } from "./finding-kinds.js";
import type { Node } from "./nodes.js";
import { Trace } from "../trace/index.js";

/** A requirement beyond "a row fills it". */
export type FieldRule =
  | { kind: "distinct_periods"; min: number }
  | { kind: "number_on_latest" };

/** One field a `fields` deliverable names: an attribute's key, a measurement's metric, or any row of another kind. */
export interface FieldSpec {
  key: string;
  record: FindingKind;
  required: boolean;
  describe: string;
  /** What `finish` tells the agent to do about it, where "record it" is not enough. */
  how?: string;
  rule?: FieldRule;
}

/** One part of each item in a `list` deliverable: a field of the item's row. */
export interface ItemPart {
  key: string;
  required: boolean;
  describe: string;
}

/** What a `per_item` deliverable needs for each item, checked in order: the first one open is the item's open need. */
export interface ItemNeed {
  key: string;
  record: FindingKind;
  match: readonly string[];
  field?: string;
  describe: string;
}

export type ItemSource =
  | { from: "ledger"; kind: FindingKind; by: string; only?: { present: string; absent: string } }
  | { from: "markets"; times: readonly string[] };

export interface FieldsDeliverable {
  shape: "fields";
  node: Node | null;
  fields: readonly FieldSpec[];
}

export interface ListDeliverable {
  shape: "list";
  node: Node;
  item: FindingKind;
  classes: readonly string[];
  parts: readonly ItemPart[];
  stop: { kind: "saturation"; quietRun: number };
}

/** Across all items: at least one row of `record` has `field` equal to `value` (one active the product's story rests on). */
export interface OneMarked {
  key: string;
  record: FindingKind;
  field: string;
  value: string;
  describe: string;
}

export interface PerItemDeliverable {
  shape: "per_item";
  node: Node;
  over: ItemSource;
  needs: readonly ItemNeed[];
  oneMarked?: OneMarked;
}

/** What a role must leave in the ledger before it is done, compulsory and optional; its prompt table, its finish check and its turn-limit gaps are read from this. */
export type Deliverable = FieldsDeliverable | ListDeliverable | PerItemDeliverable;

export class Deliverables {
  /** The finding kinds a deliverable's content is recorded as, in the order it names them. */
  static kinds(deliverable: Deliverable): FindingKind[] {
    Trace.line(import.meta.url, "Deliverables.kinds", { shape: deliverable.shape });
    switch (deliverable.shape) {
      case "fields":
        return [...new Set(deliverable.fields.map((field) => field.record))];
      case "list":
        return [deliverable.item];
      case "per_item":
        return [...new Set(deliverable.needs.map((need) => need.record))];
    }
  }
}
