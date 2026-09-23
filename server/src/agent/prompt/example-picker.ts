import { STAGE_NODES, Stages, type Node, type Stage } from "../../domain/index.js";

import { EXAMPLE } from "./text/example.js";

/** The worked example, cut down to the one stage the run covers. */
export class WorkedExample {
  static forStage(stage: Stage): Record<string, unknown> {
    const mine = <T extends { node: string }>(items: readonly T[]): T[] =>
      items.filter((item) => Stages.of(item.node as Node) === stage);
    const hasCompetitors = STAGE_NODES[stage].includes("competitors");
    return {
      ...EXAMPLE,
      stage,
      sources: mine(EXAMPLE.sources),
      excerpts: mine(EXAMPLE.excerpts),
      measurements: mine(EXAMPLE.measurements),
      attributes: mine(EXAMPLE.attributes),
      competitor_reference: hasCompetitors ? EXAMPLE.competitor_reference : null,
      competitors: hasCompetitors ? EXAMPLE.competitors : [],
      saturation: mine(EXAMPLE.saturation),
      nodes: mine(EXAMPLE.nodes),
      gaps: mine(EXAMPLE.gaps),
    };
  }
}
