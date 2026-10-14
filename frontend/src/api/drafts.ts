import { request } from './client';

export interface DraftSection {
  key: string;
  text: string;
}

export interface Verdict {
  criterion: string;
  pass: boolean;
  why: string;
}

export interface Draft {
  id: string;
  version: number;
  run_id: string;
  playbook: string;
  sections: DraftSection[];
  by: 'writer' | 'owner';
  status: 'writing' | 'critique' | 'review' | 'approved' | 'rejected';
  verdicts: Verdict[];
  created_at: string;
}

export interface DraftView {
  sections: { key: string; title: string; text: string }[];
  notes: { id: string; kind: string; value: string }[];
}

export interface DraftPage {
  draft: Draft;
  view: DraftView;
  playbook: { title: string; criteria: string[] } | null;
}

export const draftApi = {
  getDraft: (id: string) => request<DraftPage>(`/api/research/drafts/${id}`),
  writeDraft: (planId: string) =>
    request<{ id: string }>(`/api/research/plans/${planId}/write`, { method: 'POST', body: JSON.stringify({ playbook: 'long_form_static' }) }),
  editDraft: (id: string, sections: DraftSection[]) =>
    request<Draft>(`/api/research/drafts/${id}/edit`, { method: 'POST', body: JSON.stringify({ sections }) }),
  approveDraft: (id: string) => request<Draft>(`/api/research/drafts/${id}/approve`, { method: 'POST' }),
  rejectDraft: (id: string, why: string) => request<Draft>(`/api/research/drafts/${id}/reject`, { method: 'POST', body: JSON.stringify({ why }) }),
};
