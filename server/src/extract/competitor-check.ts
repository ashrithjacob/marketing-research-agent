import { COMPETITORS_DELIVERABLE, CheckProblems, Relations, type CheckProblem, type Competitor, type CompetitorReference, type StagePacket } from "../domain/index.js";

import type { PacketCheck, PacketContext } from "./check.js";
import { ListCheck } from "./list-check.js";
import { SharedActives } from "./shared-actives.js";
import { Trace } from "../trace/index.js";

/** A competitor sells to the product's own customer; its kind follows from the actives it shares with the product and its form. */
export class CompetitorCheck implements PacketCheck {
  problems(packet: StagePacket, { sourceIds }: PacketContext): CheckProblem[] {
    Trace.line(import.meta.url, "CompetitorCheck.problems", { packet });
    const reference = packet.competitor_reference;
    const problems: CheckProblem[] = [];

    if (packet.competitors.length > 0 && !reference) {
      problems.push(
        CheckProblems.of(
          "competitors are listed but competitor_reference is missing — direct and " +
          "indirect are measured against the product's own form and actives",
        ),
      );
    }
    if (reference && !sourceIds.has(reference.source_id)) {
      problems.push(
        CheckProblems.at("competitor_reference", reference, `competitor_reference cites source '${reference.source_id}', which is not in the packet`),
      );
    }

    const kinds = new Map(packet.sources.map((source) => [source.id, source.kind]));
    const seen = new Set<string>();

    for (const row of packet.competitors) {
      const label = `competitor '${row.name}'`;
      if (seen.has(row.id)) problems.push(CheckProblems.of(`${label} repeats id '${row.id}'`));
      seen.add(row.id);
      const own: string[] = [];
      if (!sourceIds.has(row.source_id)) own.push(`${label} cites source '${row.source_id}', which is not in the packet`);
      own.push(...this.adProblems(row, label, sourceIds, kinds));
      if (reference) own.push(...SharedActives.problems(label, row.shared_actives, reference.actives));
      own.push(...ListCheck.parts(COMPETITORS_DELIVERABLE, row));
      if (reference) own.push(...this.relationProblems(row, label, reference));
      problems.push(...own.map((text) => CheckProblems.at("competitor", row, text)));
    }
    return problems;
  }

  private adProblems(
    row: Competitor,
    label: string,
    sourceIds: ReadonlySet<string>,
    kinds: ReadonlyMap<string, string>,
  ): string[] {
    Trace.line(import.meta.url, "CompetitorCheck.adProblems", { row, label, sourceIds, kinds });
    return row.ad_source_ids.flatMap((adId) => {
      if (!sourceIds.has(adId)) {
        return [`${label} links ad source '${adId}', which is not in the packet`];
      }
      if (kinds.get(adId) !== "ad_library") {
        return [`${label} links '${adId}' as an ad, but that source is ${kinds.get(adId)}`];
      }
      return [];
    });
  }

  private relationProblems(
    row: Competitor,
    label: string,
    reference: CompetitorReference,
  ): string[] {
    Trace.line(import.meta.url, "CompetitorCheck.relationProblems", { row, label, reference });
    const expected = Relations.expected(row.form, reference.form, row.shared_actives);
    if (expected === null) {
      const missing = !row.form_as_printed.trim()
        ? "the competitor"
        : !reference.form_as_printed.trim()
          ? "the reference"
          : "";
      if (!missing) return [];
      return [
        `${label} and the reference are both \`other\`, so \`form_as_printed\` is ` +
          `the only record of what makes them ${row.relation} — and it is empty on ${missing}`,
      ];
    }
    if (row.relation === expected) return [];
    const shares = row.shared_actives.length === 0 ? "shares none of the champion's actives" : `shares ${row.shared_actives.join(", ")}`;
    return [`${label} is labelled ${row.relation}, but it ${shares} and its form (${row.form}) is ${row.form === reference.form ? "the" : "not the"} champion's (${reference.form}), which makes it ${expected}`];
  }
}
