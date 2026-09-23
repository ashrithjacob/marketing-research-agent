import type { StagePacket } from './packet';

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
  | 'category_data';

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
  competitors?: { direct: number; indirect: number };
}

/** Mirrors `server/src/adapters/rates.ts`. Rates are dollars per million tokens. */
export interface Pricing {
  source: 'openrouter-live' | 'pi-ai-snapshot';
  fetched_at: string;
  rates: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
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
  cost?: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  pricing?: Pricing;
  billed?: Billed;
}

export interface RunSummary {
  id: string;
  status: RunStatus;
  /** 1 collects the product, its competitors and its category; 2 is review mining. */
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

export interface RunDetail extends RunSummary {
  packet: StagePacket | null;
  /** "tool" when the agent validated mid-run; "output" when read from the final message. */
  packet_source?: string;
  output: string;
  reject_kinds: string[];
  live: boolean;
}
