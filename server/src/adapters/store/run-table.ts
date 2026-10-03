
import { Clock, Ids, type ResearchRun, type RunHead, type RunUpdate, type Scope } from "../../domain/index.js";

import { Rows } from "./rows.js";
import type { SqlDatabase } from "./sql-database.js";
import { ScopeFilter } from "./scope-filter.js";
import { Trace } from "../../trace/index.js";

const COLUMNS = new Set([
  "agent_run_id",
  "session_id",
  "stage",
  "status",
  "model",
  "brief",
  "reject_kinds",
  "judgement_ids",
  "packet",
  "error",
  "output",
  "usage",
  "ended_at",
  "packet_source",
  "source_run_id",
]);

const JSON_COLUMNS = new Set(["brief", "reject_kinds", "judgement_ids", "packet", "usage"]);

export class RunTable {
  constructor(private readonly db: SqlDatabase) {}

  async create(input: {
    workspaceId: string;
    brief: Record<string, unknown>;
    model: string;
    rejectKinds: string[];
    judgementIds: string[];
    nodes?: string[];
    stage?: number;
    productId: string;
  }): Promise<ResearchRun> {
    Trace.line(import.meta.url, "RunTable.create", { input });
    const now = Clock.nowIso();
    const runId = Ids.next();
    await this.db.run(
      "INSERT INTO research_runs (id, workspace_id, product_id, status, stage, model, brief, reject_kinds," +
        " judgement_ids, nodes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        runId,
        input.workspaceId,
        input.productId,
        "queued",
        input.stage ?? 1,
        input.model,
        JSON.stringify(input.brief),
        JSON.stringify(input.rejectKinds),
        JSON.stringify(input.judgementIds),
        JSON.stringify(input.nodes ?? []),
        now,
        now,
      ],
    );
    const run = await this.get(runId);
    if (!run) throw new Error("run vanished immediately after insert");
    return run;
  }

  async get(runId: string): Promise<ResearchRun | null> {
    Trace.line(import.meta.url, "RunTable.get", { runId });
    const row = await this.db.get("SELECT * FROM research_runs WHERE id = ?", [runId]);
    return row ? Rows.run(row) : null;
  }

  async list(scope: Scope, limit = 50): Promise<ResearchRun[]> {
    Trace.line(import.meta.url, "RunTable.list", { scope, limit });
    const rows = await this.db.all(
      `SELECT * FROM research_runs WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC LIMIT ?`,
      [...ScopeFilter.args(scope), limit],
    );
    return rows.map(Rows.run);
  }

  async heads(scope: Scope): Promise<RunHead[]> {
    Trace.line(import.meta.url, "RunTable.heads", { scope });
    const rows = await this.db.all(
      "SELECT id, product_id, stage, status, created_at FROM research_runs" +
        ` WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC`,
      ScopeFilter.args(scope),
    );
    return rows.map(Rows.head);
  }

  async update(runId: string, fields: RunUpdate): Promise<void> {
    Trace.line(import.meta.url, "RunTable.update", { runId, fields });
    const keys = Object.keys(fields) as Array<keyof RunUpdate>;
    const unknown = keys.filter((key) => !COLUMNS.has(key as string));
    if (unknown.length > 0) {
      throw new Error(`not run columns: ${unknown.sort().join(", ")}`);
    }
    if (keys.length === 0) return;
    const values = keys.map((key) => {
      const value = fields[key];
      if (JSON_COLUMNS.has(key as string) && typeof value !== "string") {
        return JSON.stringify(value ?? null);
      }
      return value as string | number;
    });
    const assignments = keys.map((key) => `${key} = ?`).join(", ");
    await this.db.run(`UPDATE research_runs SET ${assignments}, updated_at = ? WHERE id = ?`, [...values, Clock.nowIso(), runId]);
  }
}
