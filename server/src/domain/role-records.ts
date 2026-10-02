import { Deliverables } from "./deliverable.js";
import type { FindingKind } from "./finding-kinds.js";
import type { RoleSpec } from "./research-roles.js";
import { Trace } from "../trace/index.js";

/** The finding kinds a role may write: what its deliverable names, plus the bookkeeping its kind of part needs. */
export class RoleRecords {
  static of(role: RoleSpec): FindingKind[] {
    Trace.line(import.meta.url, "RoleRecords.of", { role: role.id });
    const named = Deliverables.kinds(role.deliverable);
    const curve: FindingKind[] = role.deliverable.shape === "list" ? ["saturation"] : [];
    const status: FindingKind[] = role.consistency === "stage_one_node" ? ["node_status"] : [];
    return [...new Set<FindingKind>(["source", ...named, ...curve, ...status, "gap"])];
  }
}
