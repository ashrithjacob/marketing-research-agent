import { RoleRecords, Roles, type Brief, type Node, type RoleSpec, type Trip } from "../domain/index.js";
import { DeliverableChecks } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import { CustomerContract } from "./customer-contract.js";
import { ChampionContract, NodeContract, TruthContract, type DoneCheck } from "./done-check.js";
import { LimitClose, type LimitClosed } from "./limit-close.js";
import { RoleDone } from "./role-done.js";
import type { RowRepair } from "./row-repair.js";
import type { RunFindings } from "./run-findings.js";

export interface CheckedRun {
  brief: Brief;
  nodes: readonly Node[];
  markets: readonly string[];
}

/** A role's finish check — its deliverable, then the consistency its `consistency` names — and what closes it at its turn limit. */
export class RoleChecks {
  static done(role: RoleSpec, findings: RunFindings, run: CheckedRun): DoneCheck {
    Trace.line(import.meta.url, "RoleChecks.done", { role: role.id });
    return new RoleDone(findings, DeliverableChecks.of(role.deliverable, run.markets), RoleChecks.consistency(role, findings, run));
  }

  /** The champion has no node of its own to gap and report, so a breaker only stops it. */
  static closer(role: RoleSpec, findings: RunFindings, repair: RowRepair, check: DoneCheck, run: CheckedRun): ((trip: Trip) => Promise<LimitClosed>) | null {
    Trace.line(import.meta.url, "RoleChecks.closer", { role: role.id });
    if (role.consistency === "champion") return null;
    const part = { node: Roles.node(role, run.nodes), reports: RoleRecords.of(role).includes("node_status") };
    return (trip) => new LimitClose(findings, repair, check, DeliverableChecks.of(role.deliverable, run.markets), part).close(trip);
  }

  private static consistency(role: RoleSpec, findings: RunFindings, run: CheckedRun): DoneCheck {
    Trace.line(import.meta.url, "RoleChecks.consistency", { role: role.id, consistency: role.consistency });
    switch (role.consistency) {
      case "champion":
        return new ChampionContract(findings, run.brief);
      case "stage_one_node":
      case "market_node":
        return new NodeContract(findings, { brief: run.brief, node: Roles.node(role, run.nodes), champion: role.id === "competitors" ? "champion" : null });
      case "product_truth":
        return new TruthContract(findings);
      case "customer_node":
        return new CustomerContract(findings, new NodeContract(findings, { brief: run.brief, node: Roles.node(role, run.nodes), champion: null }));
    }
  }
}
