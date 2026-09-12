/** The service's API, typed. Mirrors `backend/mra/schema.py`. */

export type RunStatus =
  | 'queued'
  | 'running'
  | 'stopping'
  | 'completed'
  /** The agent finished and what it produced broke the contract. Not the same
   *  as `failed`, and shown differently: it is the informative one. */
  | 'invalid'
  | 'failed'
  | 'cancelled';

export type ResearchNode =
  | 'product_data'
  | 'competitors'
  | 'review_mining'
  | 'category_data';

/** Statuses from which a run never moves again. Anything else is live. */
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

export interface RunCounts {
  sources: number;
  rejected: number;
  excerpts: number;
  measurements: number;
  attributes: number;
  gaps: number;
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface RunSummary {
  id: string;
  status: RunStatus;
  stage: number;
  model: string;
  brief: Brief;
  error: string;
  created_at: string;
  updated_at: string;
  ended_at: string;
  usage: Usage;
  counts: RunCounts;
}

export interface Source {
  id: string;
  url: string;
  title?: string;
  kind: string;
  publisher?: string;
  fetched_at?: string;
  first_seen?: string | null;
  marketing?: boolean;
  admitted: boolean;
  admission_reason?: string;
  archived?: boolean;
  node: ResearchNode;
}

export interface Excerpt {
  id: string;
  source_id: string;
  text: string;
  captured_at?: string;
  node: ResearchNode;
  star_rating?: number | null;
  posted_at?: string;
  axis?: 'why_bought' | 'why_stayed' | 'why_quit' | null;
  themes?: string[];
}

export interface Measurement {
  id: string;
  node: ResearchNode;
  metric: string;
  value: number | string;
  unit?: string;
  period?: string;
  source_id: string;
}

export interface AttributeRecord {
  id: string;
  node: ResearchNode;
  key: string;
  value: string;
  source_id: string;
}

export interface SaturationPoint {
  source_id: string;
  new_themes: number;
  cumulative_themes: number;
}

export interface Saturation {
  node: ResearchNode;
  curve: SaturationPoint[];
  stopped_because?: string;
}

export interface NodeStatus {
  node: ResearchNode;
  status: 'complete' | 'incomplete';
  done_criterion_met: boolean;
  why?: string;
}

export interface Gap {
  node: ResearchNode;
  missing: string;
  would_need?: string;
  blocking?: boolean;
}

export interface StagePacket {
  contract_version: string;
  stage: number;
  brief: Brief;
  sources: Source[];
  excerpts: Excerpt[];
  measurements: Measurement[];
  attributes: AttributeRecord[];
  saturation: Saturation[];
  nodes: NodeStatus[];
  gaps: Gap[];
}

export interface RunDetail extends RunSummary {
  packet: StagePacket | null;
  output: string;
  reject_kinds: string[];
  live: boolean;
}

export interface Judgement {
  id: string;
  kind: 'source_rule' | 'weighting' | 'avatar_rule' | 'language_rule' | 'custom';
  text: string;
  rejects_kinds: string[];
  active: boolean;
  applied_count: number;
  created_at: string;
}

export interface Config {
  default_reject_kinds: string[];
  model: string;
  corpus_path: string;
  /** False means every source comes back unarchived and the run fills with
   *  gaps. Said before you pay for the run rather than after. */
  corpus_mounted: boolean;
  stage0: {
    /** False means TRENDTRACK_API_KEY is unset and stage 0 cannot run at all. */
    configured: boolean;
    defaults: StageZeroParams;
    big_five: string[];
    min_trustpilot_rating: number;
    cache_days: number;
    cache: CacheStats;
  };
}

// -- stage 0 ----------------------------------------------------------------

export interface StageZeroParams {
  pages: number;
  minMonthlyVisits: number;
  minActiveAds: number;
  minProductsCount: number;
  minGrowth180d: number;
  minGrowth90d: number;
  minUps: number;
  minBaseline: number;
  minTrustpilotRating: number;
  mrrBatchSize: number;
  model: string;
}

/** A month in the reconstructed series. `t-6` is estimated from `growth180d`. */
export interface Month {
  offset: number;
  label: string;
  period: string;
  visits: number | null;
  estimated: boolean;
  low?: number;
  high?: number;
}

export interface ShopCandidate {
  id: string;
  domain: string;
  name: string;
  category: string;
  monthlyVisits: number | null;
  growth30d: number | null;
  growth90d: number | null;
  growth180d: number | null;
  history: number[];
  ups: number;
  ratio: number;
  activeAds: number | null;
  productsCount: number | null;
  topMarket: string | null;
  topMarketShare: number | null;
  bigFiveShare: number;
  trustpilotRating: number | null;
  trustpilotReviews: number | null;
  months: Month[];
  tMinus6Warning: string;
  mrrScore: number | null;
}

export interface ScoredProduct {
  shopId: string;
  domain: string;
  category: string;
  title: string;
  price: number | null;
  currency: string;
  /** Null means the model returned no verdict — not a zero, which means "durable". */
  score: number | null;
  reason: string;
}

/** Where the candidates went. Counts, not adjectives. */
export interface Funnel {
  returned: number;
  afterDuplicates: number;
  afterSeries: number;
  afterUps: number;
  afterBaseline: number;
  afterMirrors: number;
  afterBigFive: number;
  afterTrustpilot: number;
  productsConsidered: number;
  productsScored: number;
}

/** What the response cache did. `creditsSaved` is a sum of prices actually
 *  paid earlier, not an estimate. */
export interface CacheLedger {
  hits: number;
  misses: number;
  stale: number;
  creditsSaved: number;
  oldestUsedSeconds: number;
  maxAgeDays: number;
}

export interface CacheStats {
  entries: number;
  queries: number;
  shops: number;
  creditsStored: number;
  oldest: string;
  newest: string;
}

export interface StageZeroResult {
  params: StageZeroParams;
  matchedTotal: number;
  funnel: Funnel;
  /** TrendTrack credits. Billed per returned row on search, flat per detail call. */
  credits: { rows: number; details: number; free: number; total: number };
  /** Null when the cache is switched off. */
  cache: CacheLedger | null;
  shops: ShopCandidate[];
  products: ScoredProduct[];
  problems: string[];
  finishedAt: string;
}

export type DiscoveryStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export const DISCOVERY_TERMINAL: ReadonlySet<string> = new Set([
  'completed',
  'failed',
  'cancelled',
]);

export interface DiscoverySummary {
  id: string;
  status: DiscoveryStatus;
  error: string;
  created_at: string;
  updated_at: string;
  ended_at: string;
  credits: StageZeroResult['credits'] | null;
  shops: number;
  products: number;
}

export interface DiscoveryRun {
  id: string;
  status: DiscoveryStatus;
  params: Partial<StageZeroParams>;
  result: StageZeroResult | null;
  progress: Array<{ step: string; detail: Record<string, unknown>; at: string }>;
  error: string;
  created_at: string;
  updated_at: string;
  ended_at: string;
  live: boolean;
}

export interface RunEvent {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      detail = (await response.json()).detail ?? detail;
    } catch {
      /* keep the status line */
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const api = {
  session: () =>
    request<{ authenticated: boolean; user: string | null; auth_required: boolean }>(
      '/api/auth/session',
    ),
  login: (username: string, password: string) =>
    request<{ user: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  config: () => request<Config>('/api/research/config'),
  runs: () => request<{ data: RunSummary[] }>('/api/research/runs'),
  run: (id: string) => request<RunDetail>(`/api/research/runs/${id}`),
  startRun: (brief: Brief, model = '') =>
    request<RunSummary>('/api/research/runs', {
      method: 'POST',
      body: JSON.stringify({ brief, model }),
    }),
  stopRun: (id: string) =>
    request<{ ok: boolean }>(`/api/research/runs/${id}/stop`, { method: 'POST' }),
  steer: (id: string, judgement: { kind: string; text: string; rejects_kinds: string[] }) =>
    request<Judgement>(`/api/research/runs/${id}/steer`, {
      method: 'POST',
      body: JSON.stringify(judgement),
    }),
  judgements: () => request<{ data: Judgement[] }>('/api/research/judgements'),
  addJudgement: (judgement: { kind: string; text: string; rejects_kinds: string[] }) =>
    request<Judgement>('/api/research/judgements', {
      method: 'POST',
      body: JSON.stringify(judgement),
    }),
  deleteJudgement: (id: string) =>
    request<{ ok: boolean }>(`/api/research/judgements/${id}`, { method: 'DELETE' }),
  sourceUrl: (runId: string, sourceId: string) =>
    `/api/research/runs/${runId}/sources/${sourceId.replace(/^sha256:/, '')}`,

  discoveries: () =>
    request<{ data: DiscoverySummary[] }>('/api/research/discovery'),
  discovery: (id: string) =>
    request<DiscoveryRun>(`/api/research/discovery/${id}`),
  startDiscovery: (params: Partial<StageZeroParams>) =>
    request<DiscoveryRun>('/api/research/discovery', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  stopDiscovery: (id: string) =>
    request<{ ok: boolean }>(`/api/research/discovery/${id}/stop`, {
      method: 'POST',
    }),
  cacheStats: () =>
    request<CacheStats & { max_age_days: number }>('/api/research/discovery/cache'),
  clearCache: () =>
    request<{ dropped: number; credits_to_rebuy: number }>(
      '/api/research/discovery/cache',
      { method: 'DELETE' },
    ),
};

/**
 * Follow a run's events, replaying everything after `after` first.
 *
 * `EventSource` would do here — this is a GET — but hand-parsing gives us the
 * abort handle for free and keeps one SSE implementation in the codebase.
 * Returns a function that stops following.
 */
export function streamRunEvents(
  runId: string,
  after: number,
  handlers: {
    onEvent: (event: RunEvent) => void;
    onEnd: (reason: string) => void;
    onError: (message: string) => void;
  },
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`/api/research/runs/${runId}/events?after=${after}`, {
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        handlers.onError(await response.text());
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let split: number;
        while ((split = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          let name = 'message';
          let data = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) name = line.slice(7).trim();
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (!data) continue; // `: keepalive`
          const payload = JSON.parse(data);
          if (name === 'event') handlers.onEvent(payload as RunEvent);
          else if (name === 'end') handlers.onEnd(payload.reason ?? '');
        }
      }
      handlers.onEnd('stream closed');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        handlers.onError((error as Error).message);
      }
    }
  })();

  return () => controller.abort();
}
