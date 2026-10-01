import type { CallsResponse } from './calls';
import type { Config } from './config';
import type { Judgement } from './judgements';
import type { Brief, ProductSummary, ResearchNode, RunDetail, RunSummary } from './runs';
import type { ReviewAnalysisResponse } from './review-analysis';
import type { ProductTruthInputs } from './product-truth';
import type { ReviewMiningPlanResponse, TargetListing } from './review-mining';

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
    } catch {}
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export interface Session {
  authenticated: boolean;
  user: string | null;
  workspace?: string;
  is_admin?: boolean;
  auth_required: boolean;
}

export const api = {
  session: () => request<Session>('/api/auth/session'),
  login: (username: string, password: string) =>
    request<{ user: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  config: () => request<Config>('/api/research/config'),
  products: () => request<{ data: ProductSummary[] }>('/api/research/products'),
  product: (id: string) => request<ProductSummary>(`/api/research/products/${id}`),
  productRuns: (id: string) =>
    request<{ data: RunSummary[] }>(`/api/research/products/${id}/runs`),
  run: (id: string) => request<RunDetail>(`/api/research/runs/${id}`),
  startRun: (brief: Brief, nodes: ResearchNode[] = [], targets: string[] = [], inputs?: ProductTruthInputs) =>
    request<RunSummary>('/api/research/runs', {
      method: 'POST',
      body: JSON.stringify({ brief, nodes, targets, ...(inputs ? { inputs } : {}) }),
    }),
  reviewMiningPlan: (brief: Brief, targets: string[] = []) =>
    request<ReviewMiningPlanResponse>('/api/research/review-mining/plan', {
      method: 'POST',
      body: JSON.stringify({ brief, targets }),
    }),
  reviewMiningListings: (brief: Brief) =>
    request<{ listings: TargetListing[] }>('/api/research/review-mining/listings', {
      method: 'POST',
      body: JSON.stringify({ brief }),
    }),
  reviewAnalysis: (id: string) =>
    request<ReviewAnalysisResponse>(`/api/research/runs/${id}/review-analysis`),
  startReviewAnalysis: (id: string) =>
    request<ReviewAnalysisResponse>(`/api/research/runs/${id}/review-analysis`, { method: 'POST' }),
  /** Every LLM call, or only those after `after` (a seq), plus the run's totals. */
  calls: (id: string, after = 0) =>
    request<CallsResponse>(`/api/research/runs/${id}/calls${after > 0 ? `?after=${after}` : ''}`),
  logsUrl: (id: string) => `/runs/${id}/logs`,
  traceUrl: (id: string) => `/api/research/runs/${id}/trace`,
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
};
