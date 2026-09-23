import { COMPETITOR_RELATIONS, type Node, type StagePacket } from "../domain/index.js";

import type { PacketCheck } from "./check.js";

/** "Done" has to be a measurement, and real research always has holes. */
export class CompletenessCheck implements PacketCheck {
  problems(packet: StagePacket): string[] {
    const complete = new Set(
      packet.nodes.filter((entry) => entry.status === "complete").map((entry) => entry.node),
    );
    const problems: string[] = [];

    if (complete.has("review_mining") && !packet.excerpts.some((e) => e.star_rating === 3)) {
      problems.push("review_mining is complete but no 3-star excerpt was captured");
    }
    if (packet.gaps.length === 0) {
      problems.push(
        "gap list is empty; real research always has holes, so the run is treated as failed",
      );
    }
    return [...problems, ...this.saturationProblems(packet, complete)];
  }

  private saturationProblems(packet: StagePacket, complete: ReadonlySet<Node>): string[] {
    const curves = new Set(
      packet.saturation.filter((entry) => entry.curve.length > 0).map((entry) => entry.node),
    );
    const problems: string[] = [];
    for (const node of complete) {
      if (node === "product_data") continue;
      if (node === "competitors") {
        for (const relation of COMPETITOR_RELATIONS) {
          const has = packet.saturation.some(
            (entry) =>
              entry.node === "competitors" && entry.class === relation && entry.curve.length > 0,
          );
          if (!has) {
            problems.push(
              `competitors is complete with no ${relation} saturation curve — discovery ` +
                "saturates per class, so each class needs its own",
            );
          }
        }
        continue;
      }
      if (!curves.has(node)) {
        problems.push(
          `node ${node} is complete with no saturation curve — 'done' has to be a ` +
            "measurement, not an assertion",
        );
      }
    }
    return problems;
  }
}
