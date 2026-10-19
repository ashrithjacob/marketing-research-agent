import { request } from './client';
import type { AnalysisInput, AvatarQuote, CompetitorPick, Config, ReadAd, ReviewCoverage, Run, RunEvent, RunView, StoredAvatar, StoredReview } from './types';

const base = '/api/research';

export const runs = {
  config: () => request<Config>(`${base}/config`),
  list: () => request<{ runs: Run[] }>(`${base}/runs`),
  start: (input: Partial<AnalysisInput>) => request<{ run: Run }>(`${base}/runs`, { method: 'POST', body: JSON.stringify(input) }),
  get: (id: string) => request<RunView>(`${base}/runs/${id}`),
  confirm: (id: string, product_url: string, competitors: CompetitorPick[]) =>
    request<RunView>(`${base}/runs/${id}/confirm`, { method: 'POST', body: JSON.stringify({ product_url, competitors }) }),
  stop: (id: string) => request<{ ok: boolean }>(`${base}/runs/${id}/stop`, { method: 'POST' }),
  traceUrl: (id: string) => `${base}/runs/${id}/trace`,
  reviews: (id: string, competitor: string | null, limit = 20) =>
    request<{ coverage: ReviewCoverage[]; reviews: StoredReview[] }>(`${base}/runs/${id}/reviews?limit=${limit}${competitor ? `&competitor=${competitor}` : ''}`),
  ads: (id: string) => request<{ ads: ReadAd[] }>(`${base}/runs/${id}/ads`),
  avatars: (id: string) => request<{ avatars: StoredAvatar[]; quotes: AvatarQuote[] }>(`${base}/runs/${id}/avatars`),
  follow: (id: string, onEvent: (event: RunEvent) => void): (() => void) => {
    const source = new EventSource(`${base}/runs/${id}/events`, { withCredentials: true });
    source.addEventListener('event', (message) => onEvent(JSON.parse((message as MessageEvent<string>).data) as RunEvent));
    source.addEventListener('end', () => source.close());
    return () => source.close();
  },
};

export const FINAL_STATUSES: ReadonlySet<string> = new Set(['completed', 'invalid', 'failed', 'cancelled']);
