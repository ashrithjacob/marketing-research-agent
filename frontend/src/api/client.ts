import type { CallsResponse } from './calls';
import type { Config } from './config';
import type { Judgement } from './judgements';
import type { Brief, ResearchNode, RunDetail, RunSummary } from './runs';

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
  startRun: (brief: Brief, nodes: ResearchNode[] = [], model = '') =>
    request<RunSummary>('/api/research/runs', {
      method: 'POST',
      body: JSON.stringify({ brief, model, nodes }),
    }),
  /** Every LLM call, or only those after `after` (a seq), plus the run's totals. */
  calls: (id: string, after = 0) =>
    request<CallsResponse>(`/api/research/runs/${id}/calls${after > 0 ? `?after=${after}` : ''}`),
  logsUrl: (id: string) => `/runs/${id}/logs`,
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
