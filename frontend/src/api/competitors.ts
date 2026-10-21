import { request } from './client';
import type { CompetitorPick, RunEvent, RunView } from './types';

const base = '/api/research';

export type Candidate = CompetitorPick & { why: string };

export interface CompetitorWork {
  working: 'search' | 'add' | null;
  searched: { found: number; error: string } | null;
  added: { competitors: string[]; lines: string[] } | null;
}

function key(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url;
  }
}

export const competitors = {
  search: (id: string) => request<RunView>(`${base}/runs/${id}/competitors/search`, { method: 'POST' }),
  add: (id: string, picks: CompetitorPick[]) => request<RunView>(`${base}/runs/${id}/competitors`, { method: 'POST', body: JSON.stringify({ competitors: picks }) }),
  candidates: (view: RunView): Candidate[] => {
    const researched = new Set([...view.competitors.map((c) => key(c.url)), ...(view.product ? [key(view.product.url)] : [])]);
    return (view.run.resolution?.competitors ?? []).filter((c) => !researched.has(key(c.url)));
  },
  work: (events: RunEvent[], running: boolean): CompetitorWork => {
    const latest = [...events].reverse().find((event) => event.kind.startsWith('competitors.'));
    const kind = latest?.kind;
    return {
      working: running && kind === 'competitors.search' ? 'search' : running && kind === 'competitors.add' ? 'add' : null,
      searched: kind === 'competitors.searched' ? (latest!.payload as { found: number; error: string }) : null,
      added: kind === 'competitors.added' ? (latest!.payload as { competitors: string[]; lines: string[] }) : null,
    };
  },
};
