import { Ids, type AnalysisInput, type Run, type RunStore, type RunSummary, type RunUpdate, type Scope, type StageStates } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase, SqlValue } from "./sql-database.js";

const JSON_FIELDS: ReadonlySet<string> = new Set(["resolution", "stage_status"]);

export class RunTable implements RunStore {
  constructor(private readonly db: SqlDatabase) {}

  async create(input: { accountId: string; input: AnalysisInput; model: string; stages: StageStates }): Promise<Run> {
    Trace.line(import.meta.url, "RunTable.create", { accountId: input.accountId });
    const id = Ids.next();
    await this.db.run("INSERT INTO runs (id, account_id, status, input, stage_status, model) VALUES (?,?,?,?,?,?)", [
      id,
      input.accountId,
      "resolving",
      JSON.stringify(input.input),
      JSON.stringify(input.stages),
      input.model,
    ]);
    return (await this.get(id))!;
  }

  async get(runId: string): Promise<Run | null> {
    Trace.line(import.meta.url, "RunTable.get", { runId });
    return RunTable.run(await this.db.get("SELECT * FROM runs WHERE id = ?", [runId]));
  }

  async list(scope: Scope, limit = 50): Promise<Run[]> {
    Trace.line(import.meta.url, "RunTable.list", { accountId: scope.accountId, limit });
    const rows =
      scope.accountId === null
        ? await this.db.all("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?", [limit])
        : await this.db.all("SELECT * FROM runs WHERE account_id = ? ORDER BY created_at DESC LIMIT ?", [scope.accountId, limit]);
    return rows.map((row) => RunTable.run(row)!);
  }

  async delete(runId: string): Promise<void> {
    Trace.line(import.meta.url, "RunTable.delete", { runId });
    await this.db.run("DELETE FROM runs WHERE id = ?", [runId]);
  }

  async summaries(scope: Scope, limit = 50): Promise<RunSummary[]> {
    Trace.line(import.meta.url, "RunTable.summaries", { accountId: scope.accountId, limit });
    const rows = await this.db.all(
      "SELECT r.*," +
        " CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('name', p.name, 'brand', p.brand, 'image_url', p.image_url, 'logo_url', p.logo_url) END AS product," +
        " COALESCE((SELECT json_agg(json_build_object('brand', c.brand, 'image_url', c.image_url, 'logo_url', c.logo_url, 'relationship', c.relationship) ORDER BY c.brand)" +
        "   FROM competitors c WHERE c.product_id = r.product_id AND c.status = 'confirmed'), '[]') AS competitors," +
        " (SELECT COUNT(*) FROM reviews v WHERE v.product_id = r.product_id) AS review_count," +
        " (SELECT COUNT(*) FROM ads a WHERE a.run_id = r.id) AS ad_count," +
        " (SELECT COUNT(*) FROM avatars t WHERE t.run_id = r.id AND t.parent_id IS NULL) AS avatar_count" +
        " FROM runs r LEFT JOIN products p ON p.id = r.product_id WHERE (?::text IS NULL OR r.account_id = ?) ORDER BY r.created_at DESC LIMIT ?",
      [scope.accountId, scope.accountId, limit],
    );
    return rows.map((row) => ({ ...(RunTable.run(row) as RunSummary) }));
  }

  async updateRun(runId: string, fields: RunUpdate): Promise<void> {
    Trace.line(import.meta.url, "RunTable.updateRun", { runId, fields: Object.keys(fields) });
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return;
    const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
    const values: SqlValue[] = entries.map(([key, value]) => (JSON_FIELDS.has(key) ? JSON.stringify(value) : (value as SqlValue)));
    await this.db.run(`UPDATE runs SET ${assignments}, updated_at = now() WHERE id = ?`, [...values, runId]);
  }

  async unfinished(): Promise<Run[]> {
    Trace.line(import.meta.url, "RunTable.unfinished");
    const rows = await this.db.all("SELECT * FROM runs WHERE status IN ('resolving', 'running', 'stopping') ORDER BY created_at");
    return rows.map((row) => RunTable.run(row)!);
  }

  private static run(row: Record<string, any> | null): Run | null {
    Trace.line(import.meta.url, "RunTable.run", { found: row !== null });
    if (!row) return null;
    return { ...row, ended_at: row.ended_at ?? "" } as Run;
  }
}
