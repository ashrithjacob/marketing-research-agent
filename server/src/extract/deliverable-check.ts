import type { Deliverable, Finding, RowRef } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { FieldsCheck } from "./fields-check.js";
import { ListCheck } from "./list-check.js";
import { PerItemCheck } from "./per-item-check.js";

/** Something a deliverable still lacks: the key a gap must start with to close it, what to tell the agent, and the row at fault when one row is. */
export interface Missing {
  key: string;
  text: string;
  row?: RowRef;
}

/** What a deliverable still lacks, read off the rows in the ledger. */
export interface DeliverableCheck {
  missing(rows: readonly Finding[]): Missing[];
}

export class DeliverableChecks {
  static of(deliverable: Deliverable, markets: readonly string[]): DeliverableCheck {
    Trace.line(import.meta.url, "DeliverableChecks.of", { shape: deliverable.shape });
    switch (deliverable.shape) {
      case "fields":
        return new FieldsCheck(deliverable);
      case "list":
        return new ListCheck(deliverable);
      case "per_item":
        return new PerItemCheck(deliverable, markets);
    }
  }
}
