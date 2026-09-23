import { NODES, Stages, type Node, type StagePacket } from "../domain/index.js";

import type { PacketCheck, PacketContext } from "./check.js";

/** A run covers one stage, and a partial run covers only the nodes it names. */
export class ScopeCheck implements PacketCheck {
  private static noded(packet: StagePacket): ReadonlyArray<ReadonlyArray<{ node: string }>> {
    return [
      packet.sources,
      packet.excerpts,
      packet.measurements,
      packet.attributes,
      packet.saturation,
      packet.nodes,
      packet.gaps,
    ];
  }

  problems(packet: StagePacket, context: PacketContext): string[] {
    return [
      ...this.stageProblems(packet, context),
      ...this.foreignNodeProblems(packet, context),
      ...this.outsideScopeProblems(packet, context),
    ];
  }

  private stageProblems(packet: StagePacket, { scope, stage }: PacketContext): string[] {
    if (packet.stage === stage) return [];
    return [
      `packet says stage ${packet.stage}, but this run collects ${scope.join(", ")}, ` +
        `which is stage ${stage}`,
    ];
  }

  private foreignNodeProblems(packet: StagePacket, { stage }: PacketContext): string[] {
    const foreign = new Set<string>();
    for (const items of ScopeCheck.noded(packet)) {
      for (const { node } of items) {
        if (NODES.includes(node as Node) && Stages.of(node as Node) !== stage) foreign.add(node);
      }
    }
    return [...foreign].map(
      (node) =>
        `entries are recorded against ${node}, which is collected in stage ` +
        `${Stages.of(node as Node)}, not stage ${stage} — that is a separate run`,
    );
  }

  private outsideScopeProblems(packet: StagePacket, { scope }: PacketContext): string[] {
    if (!Stages.isPartial(scope)) return [];
    const allowed = new Set<string>(scope);
    const outside = new Map<string, number>();
    for (const items of ScopeCheck.noded(packet)) {
      for (const { node } of items) {
        if (!allowed.has(node)) outside.set(node, (outside.get(node) ?? 0) + 1);
      }
    }
    const competitorRows = packet.competitors.length + (packet.competitor_reference ? 1 : 0);
    if (competitorRows > 0 && !allowed.has("competitors")) {
      outside.set("competitors", (outside.get("competitors") ?? 0) + competitorRows);
    }

    const problems = [...outside].map(
      ([node, count]) =>
        `${count} entr${count === 1 ? "y is" : "ies are"} recorded against ${node}, ` +
        `which is outside this run's scope (${scope.join(", ")})`,
    );
    const reported = new Set(packet.nodes.map((entry) => entry.node));
    for (const node of scope) {
      if (!reported.has(node)) {
        problems.push(`nodes has no entry for ${node}, the node this run covers`);
      }
    }
    return problems;
  }
}
