import type { CostService } from "./charges.js";
import type { ToolName } from "./research-roles.js";

export const COST_COLUMNS = ["llm", "apify", "parallel", "trendtrack", "page_reading"] as const;
export type CostColumn = (typeof COST_COLUMNS)[number];

/** Which report column a service's charges land in: both page readers are one column. */
export const SERVICE_COLUMN: Readonly<Record<CostService, CostColumn>> = {
  openrouter: "llm",
  apify: "apify",
  parallel: "parallel",
  trendtrack: "trendtrack",
  firecrawl: "page_reading",
  crawl4ai: "page_reading",
};

/** The columns a tool can spend in: an agent's row shows the columns of the tools it has, and llm. */
export const TOOL_COST_COLUMNS: Readonly<Record<ToolName, readonly CostColumn[]>> = {
  web_search: ["parallel"],
  web_fetch: ["page_reading"],
  evidence_search: ["parallel"],
  evidence_fetch: ["parallel", "page_reading"],
  discover_competitors: ["parallel"],
  ad_library_search: ["trendtrack"],
  amazon_find_product: ["apify"],
  wait_for: [],
};

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
