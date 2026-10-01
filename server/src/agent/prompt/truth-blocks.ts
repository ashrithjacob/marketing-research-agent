import type { Active, DoseAssessment, StagePacket } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** The parts of a product-truth agent's instructions that come from what stage 1 and the earlier agents recorded. */
export class TruthBlocks {
  static stageOne(packet: StagePacket): string {
    Trace.line(import.meta.url, "TruthBlocks.stageOne", { runId: packet.run_id });
    const facts = packet.attributes.filter((a) => a.node === "product_data").map((a) => `- **${a.key}:** ${a.value}`);
    const gaps = packet.gaps.filter((g) => g.node === "product_data").map((g) => `- gap: ${g.missing}`);
    const champion = packet.competitor_reference;
    const lines = ["## What stage 1 found", "", `Stage-1 run \`${packet.run_id}\`, product fact sheet as recorded:`, "", ...facts, ...gaps];
    if (champion) lines.push("", `Champion: ${champion.name} — actives: ${champion.actives.join(", ")}`);
    return lines.join("\n");
  }

  static actives(actives: readonly Active[]): string {
    Trace.line(import.meta.url, "TruthBlocks.actives", { actives: actives.length });
    if (actives.length === 0) return "## The formula\n\nThe formula agent recorded no actives; read its gaps with `read_ledger`.";
    const lines = actives.map((a) => {
      const amount = a.amount === null ? "no amount stated" : `${a.amount} ${a.unit} per serving`;
      return `- \`${a.name}\` — ${amount}${a.form ? `, ${a.form}` : ""}${a.in_blend ? ", in a proprietary blend" : ""}`;
    });
    return ["## The formula", "", "Recorded by the `formula` agent. Name an active exactly as written here:", "", ...lines].join("\n");
  }

  static doses(doses: readonly DoseAssessment[]): string {
    Trace.line(import.meta.url, "TruthBlocks.doses", { doses: doses.length });
    const lines = doses.map((d) => `- \`${d.active}\` — **${d.class}**${d.ratio !== null ? ` (ratio ${d.ratio})` : ""}: ${d.why}`);
    return ["## Dose classes", "", "Computed by code from the formula and the studies recorded:", "", ...lines].join("\n");
  }
}
