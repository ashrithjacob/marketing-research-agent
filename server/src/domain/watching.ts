import type { ChargeDraft } from "./charges.js";

/** A competitor whose new ads the competitor-ads watcher looks for (spec §7.3), by brand name or landing domain. */
export interface WatchedBrand {
  id: string;
  workspace_id: string;
  term: string;
  search_in: "brand" | "domain";
  checked_at: string;
  created_at: string;
}

/** What a watcher spent outside any run, so a workspace's daily spend counts it (spec §7.4). */
export interface WorkspaceCharge extends ChargeDraft {
  workspace_id: string;
  source: string;
  created_at: string;
}

export interface WatchBook {
  brands(workspaceId: string): Promise<WatchedBrand[]>;
  addBrand(workspaceId: string, term: string, searchIn: WatchedBrand["search_in"]): Promise<WatchedBrand>;
  removeBrand(workspaceId: string, id: string): Promise<void>;
  checked(id: string, at: string): Promise<void>;
  /** When a watcher last did something keyed by `key` for a workspace; empty when never. */
  mark(workspaceId: string, key: string): Promise<string>;
  setMark(workspaceId: string, key: string, at: string): Promise<void>;
  charge(workspaceId: string, source: string, charge: ChargeDraft): Promise<void>;
  charges(workspaceId: string, since: string): Promise<WorkspaceCharge[]>;
}
