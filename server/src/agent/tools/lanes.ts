import type { Node, StagePacket } from "../../domain/index.js";

export interface FetchRecord {
  source_id: string;
  url: string;
  title: string;
  archived: boolean;
  chars: number;
  truncated: boolean;
}

export type ToolLane = "search" | "fetch" | "other";

export const TOOL_LANES: Record<string, ToolLane> = {
  web_search: "search",
  web_fetch: "fetch",
  amazon_find_product: "search",
  amazon_reviews: "fetch",
  trustpilot_reviews: "fetch",
  validate_packet: "other",
};

export const PACKET_CHECK_BUDGET = 5;

export interface PacketCheckOptions {
  nodes: readonly Node[];
  brief: { product?: unknown; url?: unknown };
  onValid: (packet: StagePacket) => void;
  onChecked?: (valid: boolean, problems: readonly string[]) => void;
}
