import type { MiningTarget } from "../../domain/index.js";

import { RELATION_LABEL, ROSTER_LEAD, ROSTER_METHOD } from "./text/roster.js";

/** The roster stage 1 handed over, rendered as the run's scope and its work order. */
export class RosterBlock {
  static text(targets: readonly MiningTarget[], selected: readonly string[]): string {
    const chosen = new Set(selected);
    const lines = ["## Targets from stage 1", "", ROSTER_LEAD, ""];
    for (const target of targets) {
      const state = selected.length === 0 || chosen.has(target.id) ? "" : " (out of scope this run)";
      lines.push(
        `- **${target.id}** — ${RELATION_LABEL[target.relation]}${state}: ${target.name} ` +
          `(${target.form}; shares ${target.actives.join(", ")})${target.url ? ` — ${target.url}` : ""}`,
      );
    }
    lines.push("", ROSTER_METHOD);
    return lines.join("\n");
  }
}
