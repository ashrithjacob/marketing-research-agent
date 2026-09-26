import type Database from "better-sqlite3";

import { Clock, Ids, type ResearchRun, type RunHead, type RunUpdate, type Scope } from "../../domain/index.js";

import { Rows } from "./rows.js";
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
]);

const JSON_COLUMNS = new Set(["brief", "reject_kinds", "judgement_ids", "packet", "usage"]);

export class RunTable {
  constructor(private readonly db: Database.Database) {}

  create(input: {
    workspaceId: string;
    brief: Record<string, unknown>;
    model: string;
    rejectKinds: string[];
    judgementIds: string[];
    nodes?: string[];
    stage?: number;
    productId: string;
  }): ResearchRun {
    Trace.line(import.meta.url, "RunTable.create", { input });
    const now = Clock.nowIso();
    const runId = Ids.next();
    this.db
      .prepare(
        "INSERT INTO research_runs (id, workspace_id, product_id, status, stage, model, brief, reject_kinds," +
          " judgement_ids, nodes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
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
      );
    const run = this.get(runId);
    if (!run) throw new Error("run vanished immediately after insert");
    return run;
  }

  get(runId: string): ResearchRun | null {
    Trace.line(import.meta.url, "RunTable.get", { runId });
    const row = this.db.prepare("SELECT * FROM research_runs WHERE id = ?").get(runId);
    return row ? Rows.run(row as Record<string, any>) : null;
  }

  list(scope: Scope, limit = 50): ResearchRun[] {
    Trace.line(import.meta.url, "RunTable.list", { scope, limit });
    const rows = this.db
      .prepare(
        `SELECT * FROM research_runs WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC LIMIT ?`,
      )
      .all(...ScopeFilter.args(scope), limit) as Array<Record<string, any>>;
    return rows.map(Rows.run);
  }

  heads(scope: Scope): RunHead[] {
    Trace.line(import.meta.url, "RunTable.heads", { scope });
    const rows = this.db
      .prepare(
        "SELECT id, product_id, stage, status, created_at FROM research_runs" +
          ` WHERE ${ScopeFilter.sql("workspace_id")} ORDER BY created_at DESC`,
      )
      .all(...ScopeFilter.args(scope)) as Array<Record<string, any>>;
    return rows.map(Rows.head);
  }

  update(runId: string, fields: RunUpdate): void {
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
    this.db
      .prepare(`UPDATE research_runs SET ${assignments}, updated_at = ? WHERE id = ?`)
      .run(...values, Clock.nowIso(), runId);
  }
}
