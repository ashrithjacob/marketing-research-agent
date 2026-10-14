import { Contracts } from "./contracts.js";
import { STAGE_NODES, type Node } from "./nodes.js";
import { Roles, type RoleSpec, type ToolName } from "./research-roles.js";
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
  write: { name: "write", tools: ["library_index", "library_read"], nodes: [], stepCeiling: 20 },
  critique: { name: "critique", tools: [], nodes: [], stepCeiling: 12 },
  analyse: { name: "analyse", tools: ["library_index", "library_read"], nodes: [], stepCeiling: 15 },
};

/** A task's contract as the role spec today's checks, records and closing already read: the primitive's tools and ceiling, the contract's deliverable. A contract with a `method` works as that stage-1 role does (its tools, checks, prompt and turn limit), except that it never waits on another agent: a plan orders tasks instead. */
export class Primitives {
  /** A research contract's role; a write or critique contract has no deliverable and so no role. */
  static role(contract: TaskContract): RoleSpec {
    Trace.line(import.meta.url, "Primitives.role", { primitive: contract.primitive, method: contract.method });
    const deliverable = Contracts.deliverable(contract);
    if (!deliverable) throw new Error(`a ${contract.primitive} contract has no deliverable, so no research role`);
    if (contract.method) {
      const role = Roles.of(contract.method);
      return { ...role, tools: role.tools.filter((tool) => tool !== "wait_for"), deliverable, waitsFor: [] };
    }
    const primitive = PRIMITIVES[contract.primitive];
    return {
      id: primitive.name,
      stage: 1,
      tools: primitive.tools,
      deliverable,
      consistency: "stage_one_node",
      maxTurns: primitive.stepCeiling,
      waitsFor: [],
    };
  }

  /** The nodes a task's run files under: its deliverable's node, or none for the champion, whose reference serves other tasks, and for a draft or verdict. */
  static nodes(contract: TaskContract): Node[] {
    Trace.line(import.meta.url, "Primitives.nodes", { shape: contract.complete.shape });
    const node = Contracts.node(contract);
    return node ? [node] : [];
  }

  /** The id a task's rows and calls carry: its stage role's for a research method, else its primitive's. */
  static agent(contract: TaskContract): string {
    Trace.line(import.meta.url, "Primitives.agent", { primitive: contract.primitive });
    return contract.primitive === "research" ? Primitives.role(contract).id : contract.primitive;
  }

  static tools(contract: TaskContract): readonly ToolName[] {
    Trace.line(import.meta.url, "Primitives.tools", { primitive: contract.primitive });
    return contract.primitive === "research" ? Primitives.role(contract).tools : PRIMITIVES[contract.primitive].tools;
  }

  static ceiling(contract: TaskContract): number {
    Trace.line(import.meta.url, "Primitives.ceiling", { primitive: contract.primitive });
    return contract.primitive === "research" ? Primitives.role(contract).maxTurns : PRIMITIVES[contract.primitive].stepCeiling;
  }
}
