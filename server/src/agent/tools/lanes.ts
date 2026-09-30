
export interface FetchRecord {
  source_id: string;
  url: string;
  title: string;
  archived: boolean;
  chars: number;
  truncated: boolean;
  filtered?: boolean;
  gate_reason?: string;
}

export type ToolLane = "search" | "fetch" | "other";

export const TOOL_LANES: Record<string, ToolLane> = {
  web_search: "search",
  web_fetch: "fetch",
  amazon_find_product: "search",
};
