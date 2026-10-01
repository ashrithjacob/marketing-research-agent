import { CheckProblems, type CheckProblem, type StagePacket } from "../domain/index.js";

import type { PacketCheck, PacketContext } from "./check.js";
import { Trace } from "../trace/index.js";

/** Everything recorded must cite a source the packet actually carries. */
export class CitationCheck implements PacketCheck {
  problems(packet: StagePacket, { sourceIds }: PacketContext): CheckProblem[] {
    Trace.line(import.meta.url, "CitationCheck.problems", { packet });
    const problems: CheckProblem[] = [];

    for (const excerpt of packet.excerpts) {
      if (!sourceIds.has(excerpt.source_id)) {
        problems.push(
          CheckProblems.at("excerpt", excerpt, `excerpt '${excerpt.id}' cites source '${excerpt.source_id}', which is not in the packet`),
        );
      }
    }

    for (const [kind, items] of [
      ["measurement", packet.measurements],
      ["attribute", packet.attributes],
    ] as const) {
      for (const item of items) {
        if (!sourceIds.has(item.source_id)) {
          problems.push(
            CheckProblems.at(kind, item, `${kind} '${item.id}' cites source '${item.source_id}', which is not in the packet`),
          );
        }
      }
    }

    for (const entry of packet.saturation) {
      for (const point of entry.curve) {
        if (!sourceIds.has(point.source_id)) {
          problems.push(
            CheckProblems.at(
              "saturation",
              entry,
              `saturation curve for ${entry.node} cites source '${point.source_id}', ` +
                "which is not in the packet",
            ),
          );
        }
      }
    }

    return [...problems, ...this.adLibraryProblems(packet).map(CheckProblems.of)];
  }

  private adLibraryProblems(packet: StagePacket): string[] {
    Trace.line(import.meta.url, "CitationCheck.adLibraryProblems", { packet });
    const gappedNodes = new Set(packet.gaps.map((gap) => gap.node));
    for (const source of packet.sources) {
      if (source.kind !== "ad_library" || !source.admitted || source.first_seen) continue;
      if (gappedNodes.has("competitors")) continue;
      return [
        `ad-library source '${source.url}' has no first_seen and no gap records the missing dates`,
      ];
    }
    return [];
  }
}
