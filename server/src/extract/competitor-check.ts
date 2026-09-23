import type { Competitor, CompetitorReference, StagePacket } from "../domain/index.js";

import type { PacketCheck, PacketContext } from "./check.js";
import { Names, Relations } from "./names.js";

/** Direct and indirect are measured against the product's own form and actives. */
export class CompetitorCheck implements PacketCheck {
  problems(packet: StagePacket, { sourceIds }: PacketContext): string[] {
    const reference = packet.competitor_reference;
    const problems: string[] = [];

    if (packet.competitors.length > 0 && !reference) {
      problems.push(
        "competitors are listed but competitor_reference is missing — direct and " +
          "indirect are measured against the product's own form and actives",
      );
    }
    if (reference && !sourceIds.has(reference.source_id)) {
      problems.push(
        `competitor_reference cites source '${reference.source_id}', which is not in the packet`,
      );
    }

    const referenceActives = new Set((reference?.actives ?? []).map(Names.normalise));
    const kinds = new Map(packet.sources.map((source) => [source.id, source.kind]));
    const seen = new Set<string>();

    for (const row of packet.competitors) {
      const label = `competitor '${row.name}'`;
      if (seen.has(row.id)) problems.push(`${label} repeats id '${row.id}'`);
      seen.add(row.id);
      if (!sourceIds.has(row.source_id)) {
        problems.push(`${label} cites source '${row.source_id}', which is not in the packet`);
      }
      problems.push(...this.adProblems(row, label, sourceIds, kinds));
      problems.push(...this.activeProblems(row, label, reference, referenceActives));
      if (reference) problems.push(...this.relationProblems(row, label, reference));
    }
    return problems;
  }

  private adProblems(
    row: Competitor,
    label: string,
    sourceIds: ReadonlySet<string>,
    kinds: ReadonlyMap<string, string>,
  ): string[] {
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

  private activeProblems(
    row: Competitor,
    label: string,
    reference: CompetitorReference | null,
    referenceActives: ReadonlySet<string>,
  ): string[] {
    const ownActives = new Set(
      row.active_ingredients.map((active) => Names.normalise(active.name_normalised)),
    );
    return row.shared_actives.map(Names.normalise).flatMap((shared) => {
      if (!ownActives.has(shared)) {
        return [`${label} lists '${shared}' as shared, but not among its own actives`];
      }
      if (reference && !referenceActives.has(shared)) {
        return [
          `${label} lists '${shared}' as shared, but the reference product's actives are ` +
            `${[...referenceActives].join(", ")} — a brand with a different active is neither ` +
            'direct nor indirect; gap it as "same problem, different active"',
        ];
      }
      return [];
    });
  }

  private relationProblems(
    row: Competitor,
    label: string,
    reference: CompetitorReference,
  ): string[] {
    const expected = Relations.expected(row.form, reference.form);
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
    return [
      `${label} is labelled ${row.relation}, but its form (${row.form}) ` +
        `${expected === "direct" ? "matches" : "differs from"} the reference's ` +
        `(${reference.form}), which makes it ${expected}`,
    ];
  }
}
