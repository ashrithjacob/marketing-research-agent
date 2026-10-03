import type { StagePacket } from './packet';
import type { ProductTruthPacket } from './product-truth';
import type { TargetListing } from './review-mining';

export type RunStatus =
  | 'queued'
  | 'running'
  | 'stopping'
  | 'completed'
  /** The agent finished and what it produced broke the contract; not the same as `failed`. */
  | 'invalid'
  | 'failed'
  | 'cancelled';

export type ResearchNode =
  | 'product_data'
  | 'competitors'
  | 'review_mining'
  | 'category_data'
  | 'mechanism'
  | 'dose_vs_study'
  | 'claim_limits'
  | 'cogs_refills';

export const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  'completed',
  'invalid',
  'failed',
  'cancelled',
]);

export interface Brief {
  product: string;
  url?: string;
  market?: string;
  notes?: string;
}

/** What to call a run on screen; a site brief has no product name until the agent reads one. */
export function briefLabel(brief: Brief | undefined): string {
  return brief?.product || brief?.url || 'untitled run';
}

export interface RunCounts {
  sources: number;
  rejected: number;
  excerpts: number;
  measurements: number;
  attributes: number;
  gaps: number;
  competitors?: { direct: number; indirect_form: number; indirect_active: number };
}

export interface Billed {
  total: number;
  turns: number;
  resolved: number;
}

/** pi-ai's Usage summed over every turn; `billed` is what OpenRouter charged, added at settle. */
export interface Usage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
  totalTokens?: number;
  billed?: Billed;
}

export interface RunSummary {
  id: string;
  workspace_id: string;
  product_id: string;
  /** The stage-1 run a product-truth or review-mining run built on. Empty on stage 1. */
  source_run_id: string;
  status: RunStatus;
  /** 1 collects the product, its competitors and its category; 2 is product truth; 3 is review mining. */
  stage: number;
  model: string;
  brief: Brief;
  nodes: ResearchNode[];
  error: string;
  created_at: string;
  updated_at: string;
  ended_at: string;
  usage: Usage;
  counts: RunCounts;
}

/** A stored product: every run whose brief reduces to the same `Briefs.key`. */
export interface ProductSummary {
  id: string;
  key: string;
  label: string;
  review_count: number;
  created_at: string;
  run_count: number;
  latest_at: string;
  latest_status: RunStatus;
  /** The newest completed run, else the newest run. */
  default_run_id: string;
}

export interface RunDetail extends RunSummary {
  /** Stage 2's packet is product truth's own shape; stages 1 and 3 share StagePacket. */
  packet: StagePacket | ProductTruthPacket | null;
  /** "finish" when the agent's finish passed, "ledger" when settled from its ledger, "pipeline" for review mining. */
  packet_source?: string;
  /** The Amazon listing stage 1 looked up for its champion and each competitor. */
  listings?: TargetListing[];
  output: string;
  reject_kinds: string[];
  live: boolean;
  /** The newest event this detail already reflects; a viewer listens from here, never replaying the run's history. */
  last_event_id: number;
}
