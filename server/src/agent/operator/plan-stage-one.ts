import { Contracts, Findings, RunStatuses, type Finding, type Node, type Plan, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { LiveRuns } from "../live-runs.js";
import { RunEnd } from "../run-end.js";
import { StageOneParts } from "../stage-one-parts.js";
import { StageOneRunAssembly } from "../stage-one-run-assembly.js";

/** A plan's stage-1 tasks made into one stage-1 run, as `Stage run` would have made: every live row of each task that delivered, copied in by code (sources once each), assembled and checked over the nodes they covered, and ended through RunEnd. Later stages read it like any stage run. It calls no model and spends nothing; what the tasks cost stays on their own runs. */
export class PlanStageOne {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
  ) {}

  /** The combined run's id, or why there is none: no task of the plan delivered. */
  async combine(plan: Plan): Promise<{ runId: string } | { error: string }> {
    Trace.line(import.meta.url, "PlanStageOne.combine", { planId: plan.id });
    const delivered = [];
    for (const task of plan.tasks.filter((t) => t.selected && t.run_id && t.contract.primitive === "research")) {
      const run = await this.store.getRun(task.run_id);
      if (run && RunStatuses.delivered(run.status)) delivered.push({ task, run });
    }
    if (delivered.length === 0) return { error: "no stage-1 task of the plan delivered anything" };
    const nodes = [...new Set(delivered.flatMap(({ task }) => Contracts.node(task.contract) ?? []))] as Node[];
    const run = await this.store.createRun({ workspaceId: plan.workspace_id, brief: plan.brief as unknown as Record<string, unknown>, model: "plan", rejectKinds: [], judgementIds: [], nodes, stage: 1 });
    await this.store.updateRun(run.id, { status: "running" });
    this.runs.emit(run.id, "run.started", { nodes, from_plan: plan.id, tasks: delivered.map(({ run: r }) => r.id) });
    const seen = new Set<string>();
    for (const { run: from } of delivered) {
      for (const row of Findings.live(await this.store.findings.list(from.id))) {
        if (PlanStageOne.repeat(row, seen)) continue;
        await this.store.findings.append({ run_id: run.id, kind: row.kind, entity: row.entity, agent_id: row.agent_id, source_id: row.source_id, payload: row.payload });
      }
    }
    const roles = StageOneParts.planned(plan.brief, nodes);
    await new RunEnd(this.store, this.runs).end(new StageOneRunAssembly(this.store.findings, run.id, { brief: plan.brief, nodes, roles }), { kind: "settled" }, { usage: {} });
    return { runId: run.id };
  }

  /** A source two tasks both recorded is copied once; every other row is the task's own. */
  private static repeat(row: Finding, seen: Set<string>): boolean {
    Trace.tick(import.meta.url, "PlanStageOne.repeat");
    if (row.kind !== "source") return false;
    const id = String(row.payload.id ?? "");
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  }
}
