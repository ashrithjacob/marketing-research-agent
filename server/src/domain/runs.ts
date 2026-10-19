import type { AnalysisInput } from "./analysis-input.js";
import type { Resolution } from "./resolution.js";
import type { StageStates } from "./stages.js";

export const RUN_STATUSES = ["resolving", "awaiting_confirmation", "running", "stopping", "completed", "invalid", "failed", "cancelled"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const FINAL_RUN_STATUSES: ReadonlySet<RunStatus> = new Set(["completed", "invalid", "failed", "cancelled"]);

/** One analysis of one product: resolved, confirmed by the user, then taken through the stages. */
export interface Run {
  id: string;
  account_id: string;
  product_id: string | null;
  status: RunStatus;
  input: AnalysisInput;
  resolution: Resolution | null;
  stage_status: StageStates;
  model: string;
  error: string;
  cost_usd: number | null;
  created_at: string;
  updated_at: string;
  ended_at: string;
}

export interface RunUpdate {
  product_id?: string;
  status?: RunStatus;
  resolution?: Resolution;
  stage_status?: StageStates;
  error?: string;
  cost_usd?: number | null;
  ended_at?: string | null;
}

/** A run as the list of analyses shows it: its product's look, its competitors' faces, and how much evidence it holds. */
export interface RunSummary extends Run {
  product: { name: string; brand: string; image_url: string | null; logo_url: string | null } | null;
  competitors: { brand: string; image_url: string | null; logo_url: string | null; relationship: string | null }[];
  review_count: number;
  ad_count: number;
  avatar_count: number;
}
