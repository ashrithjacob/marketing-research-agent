import { request } from './client';
import type { Brief } from './runs';

export interface TaskContract {
  objective: string;
  budget: { max_usd: number; max_minutes: number };
}

export interface PlanTask {
  key: string;
  title: string;
  contract: TaskContract;
  selected: boolean;
  run_id: string;
  error: string;
}

export interface Plan {
  id: string;
  workspace_id: string;
  brief: Brief;
  tasks: PlanTask[];
  status: 'draft' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'owner' | 'operator' | 'action' | 'note';
  text: string;
  partial: boolean;
}

export interface TaskCard {
  run_id: string;
  product_id: string;
  objective: string;
  status: string;
  error: string;
  sources: number;
  attributes: number;
  measurements: number;
  gaps: number;
  calls: number;
  billed_usd: number | null;
  created_at: string;
}

export interface Board {
  plans: Plan[];
  tasks: TaskCard[];
}

export const workspaceApi = {
  startPlan: (brief: Brief) => request<Plan>('/api/research/plans', { method: 'POST', body: JSON.stringify({ brief }) }),
  plan: (id: string) => request<Plan>(`/api/research/plans/${id}`),
  toggle: (id: string, key: string, selected: boolean) =>
    request<Plan>(`/api/research/plans/${id}/tasks/${key}`, { method: 'POST', body: JSON.stringify({ selected }) }),
  approve: (id: string) => request<Plan>(`/api/research/plans/${id}/approve`, { method: 'POST' }),
  say: (text: string, planId: string) =>
    request<{ ok: boolean }>('/api/research/chat', { method: 'POST', body: JSON.stringify({ text, plan_id: planId }) }),
};

/** The workspace's one stream: the chat and the board, each a whole snapshot whenever it changes. EventSource reconnects by itself, and a reconnect starts from a fresh snapshot. */
export function streamWorkspace(onChat: (chat: ChatMessage[]) => void, onBoard: (board: Board) => void, onState: (connected: boolean) => void): () => void {
  const source = new EventSource('/api/research/workspace/stream');
  source.addEventListener('chat', (event) => onChat(JSON.parse((event as MessageEvent).data) as ChatMessage[]));
  source.addEventListener('board', (event) => onBoard(JSON.parse((event as MessageEvent).data) as Board));
  source.onopen = () => onState(true);
  source.onerror = () => onState(false);
  return () => source.close();
}
