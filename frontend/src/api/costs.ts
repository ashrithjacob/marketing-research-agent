export type CostColumn = 'llm' | 'apify' | 'parallel' | 'trendtrack' | 'page_reading';

/** One column of one row: dollars where every unit is priced, else null; what was counted; how the figure was arrived at. */
export interface CostCell {
  usd: number | null;
  units: number;
  detail: string;
}

/** One agent's spend, or the run's own (`agent_id` null) for what code spent with no agent. */
export interface CostRow {
  agent_id: string | null;
  cells: Partial<Record<CostColumn, CostCell>>;
  total_usd: number;
}

export interface CostReport {
  rows: CostRow[];
  totals: Partial<Record<CostColumn, CostCell>>;
  total_usd: number;
}
