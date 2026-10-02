import { Roles, type Brief, type Node, type ProductTruthAgent, type RoleSpec, type StageOneAgent } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { DoneChecks, type DoneCheck } from "./done-check.js";
import { LimitClose, type LimitClosed } from "./limit-close.js";
import { ProductTruthDone } from "./product-truth-done.js";
import type { RowRepair } from "./row-repair.js";
import type { RunFindings } from "./run-findings.js";
import { TruthLimitClose } from "./truth-limit-close.js";

/** Which finish check a role's consistency names, and what closes it at its turn limit: the champion has no node to close. */
export class RoleChecks {
  static done(role: RoleSpec, findings: RunFindings, run: { brief: Brief; nodes: readonly Node[]; markets: readonly string[] }): DoneCheck {
    Trace.line(import.meta.url, "RoleChecks.done", { role: role.id });
    if (role.consistency === "product_truth") return new ProductTruthDone(findings, role.id as ProductTruthAgent, run.markets);
    return DoneChecks.of(role.id as StageOneAgent, findings, run.brief, run.nodes);
  }

  static closer(role: RoleSpec, findings: RunFindings, repair: RowRepair, check: DoneCheck, run: { nodes: readonly Node[]; markets: readonly string[] }): (() => LimitClosed) | null {
    Trace.line(import.meta.url, "RoleChecks.closer", { role: role.id });
    switch (role.consistency) {
      case "champion":
        return null;
      case "stage_one_node":
        return () => new LimitClose(findings, repair, check, Roles.node(role, run.nodes), role.maxTurns).close();
      case "product_truth": {
        const part = { agent: role.id as ProductTruthAgent, node: Roles.node(role, run.nodes), markets: run.markets };
        return () => new TruthLimitClose(findings, repair, check, part, role.maxTurns).close();
      }
    }
  }
}
