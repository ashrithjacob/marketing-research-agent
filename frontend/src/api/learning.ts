import { request } from './client';

export interface PlaybookSection {
  key: string;
  title: string;
  describe: string;
}

export interface Playbook {
  key: string;
  title: string;
  document_title: string;
  read_first: string[];
  sections: PlaybookSection[];
  criteria: string[];
  version: number;
  by: 'seed' | 'lesson' | 'owner' | 'rollback';
  status: 'active' | 'stale' | 'archived';
  created_at: string;
}

export interface VersionScore {
  version: number;
  by: Playbook['by'];
  created_at: string;
  tasks: number;
  first_try: number;
  decided: number;
  accepted_unchanged: number;
  corrected: number;
  ads: number;
  spend: number;
  roas: number | null;
}

export interface PlaybookReport {
  playbook: Playbook;
  versions: VersionScore[];
  flag: string | null;
}

export interface WatchedBrand {
  id: string;
  term: string;
  search_in: 'brand' | 'domain';
  checked_at: string;
}

export interface AdAccount {
  account_id: string;
  status: 'connected' | 'reconnect';
  error: string;
  read_at: string;
}

export interface AdTotals {
  days: number;
  spend: number;
  purchases: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
}

export interface DraftAd {
  ad_id: string;
  by: 'owner' | 'name';
  tag: string;
  settled: AdTotals;
  provisional: AdTotals;
}

export const learningApi = {
  playbooks: () => request<PlaybookReport[]>('/api/research/playbooks'),
  rollbackPlaybook: (key: string, version: number) =>
    request<Playbook>(`/api/research/playbooks/${key}/rollback`, { method: 'POST', body: JSON.stringify({ version }) }),
  restorePlaybook: (key: string) => request<{ ok: boolean }>(`/api/research/playbooks/${key}/restore`, { method: 'POST' }),
  distil: (documentId: string) => request<{ id: string }>(`/api/research/library/${documentId}/distil`, { method: 'POST' }),
  watchedBrands: () => request<{ data: WatchedBrand[] }>('/api/research/watch/brands'),
  addWatchedBrand: (term: string, searchIn: WatchedBrand['search_in']) =>
    request<WatchedBrand>('/api/research/watch/brands', { method: 'POST', body: JSON.stringify({ term, search_in: searchIn }) }),
  removeWatchedBrand: (id: string) => request<{ ok: boolean }>(`/api/research/watch/brands/${id}`, { method: 'DELETE' }),
  adAccounts: () => request<{ data: AdAccount[] }>('/api/research/ad-accounts'),
  connectAdAccount: (accountId: string) => request<AdAccount>('/api/research/ad-accounts', { method: 'POST', body: JSON.stringify({ account_id: accountId }) }),
  disconnectAdAccount: (accountId: string) => request<{ ok: boolean }>(`/api/research/ad-accounts/${accountId}`, { method: 'DELETE' }),
  draftAds: (draftId: string) => request<{ data: DraftAd[] }>(`/api/research/drafts/${draftId}/ads`),
  linkAd: (draftId: string, adId: string) => request<{ ok: boolean }>(`/api/research/drafts/${draftId}/ads`, { method: 'POST', body: JSON.stringify({ ad_id: adId }) }),
};
