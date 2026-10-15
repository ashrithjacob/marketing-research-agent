import { Clock, Ids, type Brief, type Plan, type PlanBook, type PlanStage, type PlanTask, type Scope } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";

type PlanRow = { id: string; workspace_id: string; brief: string; tasks: string; stages: string; stage_one_run_id: string; status: string; created_at: string; updated_at: string };

/** Plans, one row each, with their brief and tasks as JSON. */
export class PlanTable implements PlanBook {
  static readonly DDL = `
CREATE TABLE IF NOT EXISTS research_plans (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    brief        TEXT NOT NULL,
    tasks        TEXT NOT NULL,
    stages       TEXT NOT NULL DEFAULT '[]',
    stage_one_run_id TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS research_plans_workspace ON research_plans(workspace_id, created_at);
`;

  constructor(private readonly db: SqlDatabase) {}

  async create(workspaceId: string, brief: Brief, tasks: readonly PlanTask[], stages: readonly PlanStage[] = []): Promise<Plan> {
    Trace.line(import.meta.url, "PlanTable.create", { workspaceId, tasks: tasks.length });
    const now = Clock.nowIso();
    const id = Ids.next();
    await this.db.run(
      "INSERT INTO research_plans (id, workspace_id, brief, tasks, stages, stage_one_run_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [id, workspaceId, JSON.stringify(brief), JSON.stringify(tasks), JSON.stringify(stages), "", "draft", now, now],
    );
    return { id, workspace_id: workspaceId, brief, tasks: [...tasks], stages: [...stages], stage_one_run_id: "", status: "draft", created_at: now, updated_at: now };
  }

  async get(scope: Scope, planId: string): Promise<Plan | null> {
    Trace.line(import.meta.url, "PlanTable.get", { planId });
    const row = await this.db.get<PlanRow>(`SELECT * FROM research_plans WHERE id = ? AND ${ScopeFilter.sql("workspace_id")}`, [planId, ...ScopeFilter.args(scope)]);
    return row ? PlanTable.plan(row) : null;
  }

  async list(scope: Scope, limit: number): Promise<Plan[]> {
    Trace.line(import.meta.url, "PlanTable.list", { limit });
    const rows = await this.db.all<PlanRow>(
      `SELECT * FROM research_plans WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC LIMIT ?`,
      [...ScopeFilter.args(scope), limit],
    );
    return rows.map(PlanTable.plan);
  }

  async save(plan: Plan): Promise<Plan> {
    Trace.line(import.meta.url, "PlanTable.save", { planId: plan.id, status: plan.status });
    const updated = { ...plan, updated_at: Clock.nowIso() };
    await this.db.run("UPDATE research_plans SET brief = ?, tasks = ?, stages = ?, stage_one_run_id = ?, status = ?, updated_at = ? WHERE id = ?", [
      JSON.stringify(updated.brief),
      JSON.stringify(updated.tasks),
      JSON.stringify(updated.stages),
      updated.stage_one_run_id,
      updated.status,
      updated.updated_at,
      updated.id,
    ]);
    return updated;
  }

  /** A task as stored, with the fields added since it was written filled in, so a plan saved by an older build reads as one saved now. */
  private static task(stored: Partial<PlanTask>): PlanTask {
    Trace.tick(import.meta.url, "PlanTable.task");
    return { auto: false, after: [], run_id: "", error: "", selected: true, ...stored } as PlanTask;
  }

  private static plan(row: PlanRow): Plan {
    Trace.line(import.meta.url, "PlanTable.plan", { id: row.id });
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      brief: JSON.parse(row.brief) as Brief,
      tasks: (JSON.parse(row.tasks) as Partial<PlanTask>[]).map(PlanTable.task),
      stages: JSON.parse(row.stages || "[]") as PlanStage[],
      stage_one_run_id: row.stage_one_run_id ?? "",
      status: row.status as Plan["status"],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
