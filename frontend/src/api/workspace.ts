import type { Draft } from './drafts';
import { request } from './client';
import type { Brief } from './runs';

export interface TaskContract {
  objective: string;
  stop_when?: string;
  budget: { max_usd: number; max_minutes: number };
}

export interface PlanTask {
  key: string;
  title: string;
  contract: TaskContract;
  selected: boolean;
  auto: boolean;
  after: string[];
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
  role: 'owner' | 'operator';
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
  question: string;
  created_at: string;
}

export interface Card {
  id: string;
  kind: 'question' | 'approval';
  action: { kind: string; draft_id?: string; editable?: boolean };
  status: 'open' | 'answered' | 'approved' | 'rejected';
  title: string;
  body: string;
  answer: string;
  created_at: string;
  resolved_at: string;
}

export interface Feedback {
  id: string;
  verdict: 'reject' | 'edited' | 'accept' | 'answer' | 'steer' | 'outcome';
  strength: 'correction' | 'confirmation' | 'instruction' | 'outcome';
  target: { kind: string; id: string; run_id: string; plan_id: string };
  text: string;
  diff: Record<string, unknown> | null;
  created_at: string;
}

export interface MemoryEntry {
  entry_id: string;
  version: number;
  text: string;
  by: 'owner' | 'lesson';
  created_at: string;
}

export interface AlwaysOnStatus {
  on: boolean;
  daily_cap_usd: number | null;
  spent_today: number;
  running: number;
}

export interface Schedule {
  id: string;
  brief: Brief;
  task_key: string;
  every_days: number;
  last_due_at: string;
  created_at: string;
}

export interface Board {
  plans: Plan[];
  tasks: TaskCard[];
  cards: Card[];
  cards_today: number;
  feedback: Feedback[];
  memory: MemoryEntry[];
  always_on: AlwaysOnStatus;
  schedules: Schedule[];
  drafts: Draft[];
}

export const workspaceApi = {
  startPlan: (brief: Brief) => request<Plan>('/api/research/plans', { method: 'POST', body: JSON.stringify({ brief }) }),
  plan: (id: string) => request<Plan>(`/api/research/plans/${id}`),
  editTask: (id: string, key: string, change: { selected?: boolean; stop_when?: string }) =>
    request<Plan>(`/api/research/plans/${id}/tasks/${key}`, { method: 'POST', body: JSON.stringify(change) }),
  approve: (id: string) => request<Plan>(`/api/research/plans/${id}/approve`, { method: 'POST' }),
  answerCard: (id: string, answer: string) =>
    request<Card>(`/api/research/cards/${id}/answer`, { method: 'POST', body: JSON.stringify({ answer }) }),
  approveCard: (id: string, text = '') => request<Card>(`/api/research/cards/${id}/approve`, { method: 'POST', body: JSON.stringify({ text }) }),
  setAlwaysOn: (on: boolean, cap: number | null) =>
    request<AlwaysOnStatus>('/api/research/always-on', { method: 'POST', body: JSON.stringify({ on, daily_cap_usd: cap }) }),
  addSchedule: (taskKey: string, everyDays: number, brief: Brief) =>
    request<Schedule>('/api/research/schedules', { method: 'POST', body: JSON.stringify({ task_key: taskKey, every_days: everyDays, brief }) }),
  removeSchedule: (id: string) => request<{ ok: boolean }>(`/api/research/schedules/${id}`, { method: 'DELETE' }),
  addMemory: (text: string) => request<MemoryEntry>('/api/research/memory', { method: 'POST', body: JSON.stringify({ text }) }),
  editMemory: (id: string, text: string) => request<MemoryEntry>(`/api/research/memory/${id}`, { method: 'POST', body: JSON.stringify({ text }) }),
  deleteMemory: (id: string) => request<MemoryEntry>(`/api/research/memory/${id}`, { method: 'DELETE' }),
  rejectCard: (id: string) => request<Card>(`/api/research/cards/${id}/reject`, { method: 'POST' }),
  markSourceWrong: (runId: string, sourceId: string, why: string) =>
    request<Feedback>(`/api/research/runs/${runId}/sources/${encodeURIComponent(sourceId)}/wrong`, { method: 'POST', body: JSON.stringify({ why }) }),
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
