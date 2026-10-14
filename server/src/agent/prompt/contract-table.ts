import type { Deliverable } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { DeliverableTable } from "./deliverable-table.js";
import { TASK_LIST, TASK_PER_ITEM } from "./text/task.js";

/** Any deliverable as the prompt states it: a fields table, a list's classes and stop rule, or a per-item checklist. */
export class ContractTable {
  static render(deliverable: Deliverable): string {
    Trace.line(import.meta.url, "ContractTable.render", { shape: deliverable.shape });
    switch (deliverable.shape) {
      case "fields":
        return DeliverableTable.render(deliverable);
      case "list":
        return TASK_LIST.replace("{item}", deliverable.item)
          .replace("{classes}", deliverable.classes.join(", "))
          .replace("{parts}", deliverable.parts.map((part) => `\`${part.key}\`${part.required ? "" : " (optional)"} — ${part.describe}`).join("; "))
          .replace("{stop}", DeliverableTable.stop(deliverable));
      case "per_item":
        return [TASK_PER_ITEM, ...deliverable.needs.map((need) => `- \`${need.key}\` (${need.record}) — ${need.describe}`)].join("\n");
    }
  }
}
