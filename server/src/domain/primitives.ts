import { STAGE_NODES, type Node } from "./nodes.js";
import type { RoleSpec, ToolName } from "./research-roles.js";
import type { PrimitiveName, TaskContract } from "./task-contract.js";
import { Trace } from "../trace/index.js";

/** What a kind of worker is besides its contract: its tools, the nodes it may file under, and its step ceiling. */
export interface PrimitiveSpec {
  name: PrimitiveName;
  tools: readonly ToolName[];
  nodes: readonly Node[];
  stepCeiling: number;
}

export const PRIMITIVES: Readonly<Record<PrimitiveName, PrimitiveSpec>> = {
  research: { name: "research", tools: ["web_search", "web_fetch"], nodes: STAGE_NODES[1], stepCeiling: 30 },
};

/** A task's contract as the role spec today's checks, records and closing already read: the primitive's tools and ceiling, the contract's deliverable. */
export class Primitives {
  static role(contract: TaskContract): RoleSpec {
    Trace.line(import.meta.url, "Primitives.role", { primitive: contract.primitive });
    const primitive = PRIMITIVES[contract.primitive];
    return {
      id: primitive.name,
      stage: 1,
      tools: primitive.tools,
      deliverable: contract.complete,
      consistency: "stage_one_node",
      maxTurns: primitive.stepCeiling,
      waitsFor: [],
    };
  }

  static node(contract: TaskContract): Node | null {
    Trace.line(import.meta.url, "Primitives.node", { shape: contract.complete.shape });
    return contract.complete.node;
  }
}
