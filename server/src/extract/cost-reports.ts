import {
  COST_COLUMNS,
  ROLES,
  SERVICE_COLUMN,
  TOOL_COST_COLUMNS,
  type Charge,
  type CostCell,
  type CostColumn,
  type CostReport,
  type CostRow,
  type LlmCall,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** What a run cost, per agent and for the run itself: OpenRouter as billed per call, every other service from its charges. */
export class CostReports {
  static of(calls: readonly LlmCall[], charges: readonly Charge[]): CostReport {
    Trace.line(import.meta.url, "CostReports.of", { calls: calls.length, charges: charges.length });
    const agents = CostReports.agents(calls, charges);
    const rows = [
      ...agents.map((agentId) => CostReports.row(agentId, calls.filter((c) => c.agent_id === agentId), charges.filter((c) => c.agent_id === agentId))),
      ...(charges.some((c) => c.agent_id === null) ? [CostReports.row(null, [], charges.filter((c) => c.agent_id === null))] : []),
    ];
    const totals = CostReports.totals(rows);
    return { rows, totals, total_usd: CostReports.sum(Object.values(totals)) };
  }

  /** Agents in the order the roles are declared; one the roles do not know goes last. */
  private static agents(calls: readonly LlmCall[], charges: readonly Charge[]): string[] {
    Trace.line(import.meta.url, "CostReports.agents");
    const seen = new Set([...calls.map((c) => c.agent_id), ...charges.flatMap((c) => (c.agent_id === null ? [] : [c.agent_id]))]);
    const order = ROLES.map((role) => role.id as string);
    return [...seen].filter((id) => id !== "").sort((a, b) => CostReports.rank(order, a) - CostReports.rank(order, b));
  }

  private static rank(order: readonly string[], id: string): number {
    Trace.tick(import.meta.url, "CostReports.rank");
    const at = order.indexOf(id);
    return at === -1 ? order.length : at;
  }

  private static row(agentId: string | null, calls: readonly LlmCall[], charges: readonly Charge[]): CostRow {
    Trace.line(import.meta.url, "CostReports.row", { agentId, calls: calls.length, charges: charges.length });
    const role = ROLES.find((r) => r.id === agentId);
    const allowed = new Set<CostColumn>(role ? ["llm", ...role.tools.flatMap((tool) => TOOL_COST_COLUMNS[tool])] : charges.map((c) => SERVICE_COLUMN[c.service]));
    if (!role && calls.length > 0) allowed.add("llm");
    const cells: Partial<Record<CostColumn, CostCell>> = {};
    for (const column of COST_COLUMNS) {
      if (!allowed.has(column)) continue;
      cells[column] = column === "llm" ? CostReports.llm(calls) : CostReports.charged(charges.filter((c) => SERVICE_COLUMN[c.service] === column));
    }
    return { agent_id: agentId, cells, total_usd: CostReports.sum(Object.values(cells)) };
  }

  /** What OpenRouter billed; a turn whose bill has not arrived yet (about 4s after it ends) is counted, not guessed. */
  private static llm(calls: readonly LlmCall[]): CostCell {
    Trace.line(import.meta.url, "CostReports.llm", { calls: calls.length });
    const billed = calls.filter((c) => c.billed_cost !== null);
    const usd = billed.reduce((sum, c) => sum + (c.billed_cost ?? 0), 0);
    const detail = billed.length === calls.length ? `${calls.length} turns, billed` : `billed ${billed.length} of ${calls.length} turns`;
    return { usd, units: calls.length, detail };
  }

  private static charged(charges: readonly Charge[]): CostCell {
    Trace.line(import.meta.url, "CostReports.charged", { charges: charges.length });
    const units = new Map<string, number>();
    for (const c of charges) units.set(`${c.service} ${c.item}`, (units.get(`${c.service} ${c.item}`) ?? 0) + c.units);
    const unpriced = charges.some((c) => c.usd === null);
    const bases = [...new Set(charges.map((c) => c.basis))];
    const detail = [...[...units].map(([item, n]) => `${n} × ${item}`), ...(bases.length > 0 ? [bases.join("/")] : [])].join(", ");
    return {
      usd: unpriced ? null : charges.reduce((sum, c) => sum + (c.usd ?? 0), 0),
      units: charges.reduce((sum, c) => sum + c.units, 0),
      detail: unpriced ? `${detail}, some unpriced` : detail,
    };
  }

  private static totals(rows: readonly CostRow[]): Partial<Record<CostColumn, CostCell>> {
    Trace.line(import.meta.url, "CostReports.totals", { rows: rows.length });
    const totals: Partial<Record<CostColumn, CostCell>> = {};
    for (const column of COST_COLUMNS) {
      const cells = rows.flatMap((row) => (row.cells[column] ? [row.cells[column]!] : []));
      if (cells.length === 0) continue;
      const usd = cells.some((cell) => cell.usd === null) ? null : CostReports.sum(cells);
      totals[column] = { usd, units: cells.reduce((sum, cell) => sum + cell.units, 0), detail: usd === null ? "some unpriced" : "" };
    }
    return totals;
  }

  /** Dollars across cells; an unpriced cell adds nothing, and its own cell says so. */
  private static sum(cells: readonly (CostCell | undefined)[]): number {
    Trace.tick(import.meta.url, "CostReports.sum");
    return cells.reduce((sum, cell) => sum + (cell?.usd ?? 0), 0);
  }
}
