import { z } from "zod";
import { Trace } from "../trace/index.js";

export const CONTRACT_VERSION = "1";

export const NODES = [
  "product_data",
  "competitors",
  "review_mining",
  "category_data",
] as const;
export type Node = (typeof NODES)[number];

export const STAGES = [1, 2] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_NODES: Readonly<Record<Stage, readonly Node[]>> = {
  1: ["product_data", "competitors", "category_data"],
  2: ["review_mining"],
};

export const nodeSchema = z.enum(NODES);

/** Which stage collects which node, and what a run's node list means. */
export class Stages {
  static of(node: Node): Stage {
    Trace.line(import.meta.url, "Stages.of", { node });
    return STAGE_NODES[2].includes(node) ? 2 : 1;
  }

  static covering(nodes: readonly Node[]): Stage | null {
    Trace.line(import.meta.url, "Stages.covering", { nodes });
    if (nodes.length === 0) return null;
    const stages = new Set(nodes.map((node) => Stages.of(node)));
    return stages.size === 1 ? ([...stages][0] ?? null) : null;
  }

  static expand(nodes: readonly string[] | undefined): Node[] {
    Trace.line(import.meta.url, "Stages.expand", { nodes });
    const wanted = new Set(nodes ?? []);
    const scoped = NODES.filter((node) => wanted.has(node));
    return scoped.length > 0 ? scoped : [...STAGE_NODES[1]];
  }

  static isPartial(nodes: readonly Node[]): boolean {
    Trace.line(import.meta.url, "Stages.isPartial", { nodes });
    const stage = Stages.covering(nodes);
    if (stage === null) return true;
    return nodes.length < STAGE_NODES[stage].length;
  }
}
