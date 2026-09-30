import type { RunEvent, ServiceReport, ToolStep } from '../api';
import { milestoneText } from './milestones';

export interface ToolRow {
  key: string;
  tool: string;
  lane: string;
  preview: string;
  state: 'running' | 'done' | 'error';
  callId: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  /** What the failed tool told the model, when the server recorded it. */
  errorText?: string;
  inside?: ToolStep[];
  service?: ServiceReport;
}

/** One box on the timeline: a turn of the agent loop, or a run milestone. */
export interface Step {
  key: string;
  kind: 'turn' | 'milestone';
  seq: number | null;
  startedAt: string;
  endedAt?: string;
  tools: ToolRow[];
  reasoning: string[];
  message: string;
  text: string;
  cls: string;
  error: string;
  origin: 'code' | 'you' | '';
}
const TOOL_VERBS: Record<string, string> = {
  web_search: 'Searched the web',
  web_fetch: 'Read a page',
  validate_packet: 'Checked the packet against the stage-1 contract',
  finish: 'Checked its part of the ledger against the contract',
  read_ledger: 'Read the shared ledger',
  wait_for: 'Waited for another agent',
  retract: 'Withdrew a recorded finding',
  corpus_write: 'Filed material into the corpus',
  corpus_read: 'Read material back from the corpus',
};

export function toolVerb(tool: string): string {
  return TOOL_VERBS[tool] ?? tool.replace(/_/g, ' ');
}

function toolLabel(tool: string, count: number): string {
  if (tool === 'web_search') return `${count} search${count === 1 ? '' : 'es'}`;
  if (tool === 'web_fetch') return `read ${count} page${count === 1 ? '' : 's'}`;
  if (tool === 'validate_packet' || tool === 'finish') return 'packet check';
  if (tool.startsWith('record_')) return `recorded ${count} ${tool.slice('record_'.length).replace(/_/g, ' ')}${count === 1 ? '' : 's'}`;
  return `${count} × ${tool.replace(/_/g, ' ')}`;
}

/** Content events open a turn box on arrival; the `llm.call` event fills in seq and cost when the turn lands. */
export function buildSteps(events: RunEvent[]): Step[] {
  const steps: Step[] = [];
  let turn: Step | null = null;
  let turnCount = 0;
  const running = new Map<string, ToolRow[]>();

  /** Keys are positional, so filling a box in later never remounts it. */
  const openTurn = (at: string): Step => {
    const step: Step = {
      key: `turn-${turnCount++}`,
      kind: 'turn',
      seq: null,
      startedAt: at,
      tools: [],
      reasoning: [],
      message: '',
      text: '',
      cls: '',
      error: '',
      origin: '',
    };
    steps.push(step);
    return step;
  };

  const startRow = (tool: string, row: ToolRow) => {
    const queue = running.get(tool) ?? [];
    queue.push(row);
    running.set(tool, queue);
  };
  /** Pairs on the tool-call id; a run recorded before events carried one settles the oldest running call of that tool. */
  const settleRow = (event: RunEvent) => {
    const p = event.payload as Record<string, unknown>;
    const tool = String(p.tool ?? '');
    const queue = running.get(tool) ?? [];
    const callId = String(p.tool_call_id ?? '');
    const row = queue.find((r) => r.state === 'running' && (!callId || r.callId === callId));
    if (!row) return;
    row.state = p.error ? 'error' : 'done';
    row.endedAt = event.created_at;
    row.duration = (new Date(event.created_at).getTime() - new Date(row.startedAt).getTime()) / 1000;
    if (p.error && p.error_text) row.errorText = String(p.error_text);
    if (Array.isArray(p.inside)) row.inside = p.inside as ToolStep[];
    if (p.service) row.service = p.service as ServiceReport;
    running.set(
      tool,
      queue.filter((r) => r.state === 'running'),
    );
  };

  for (const event of events) {
    const p = event.payload as Record<string, unknown>;
    if (event.kind === 'llm.call') {
      if (turn && turn.seq === null) {
        turn.seq = Number(p.seq);
        turn.error = String(p.error ?? '');
      } else {
        turn = openTurn(event.created_at);
        turn.seq = Number(p.seq);
        turn.error = String(p.error ?? '');
      }
      continue;
    }
    if (event.kind === 'tool.started') {
      if (!turn) turn = openTurn(event.created_at);
      const row: ToolRow = {
        key: `${event.id}`,
        tool: String(p.tool ?? ''),
        lane: String(p.lane ?? 'other'),
        preview: String(p.preview ?? ''),
        state: 'running',
        callId: String(p.tool_call_id ?? ''),
        startedAt: event.created_at,
      };
      startRow(row.tool, row);
      turn.tools.push(row);
      continue;
    }
    if (event.kind === 'tool.completed') {
      settleRow(event);
      continue;
    }
    if (event.kind === 'reasoning.available') {
      if (!turn) turn = openTurn(event.created_at);
      turn.reasoning.push(String(p.text ?? ''));
      continue;
    }
    if (event.kind === 'message.delta') {
      if (!turn) turn = openTurn(event.created_at);
      turn.message += String(p.delta ?? '');
      continue;
    }
    if (event.kind === 'run.billed' && turn && steps.length > 0) {
      continue;
    }
    if (event.kind === 'apify.charged') continue;
    const { text, cls } = milestoneText(event);
    steps.push({
      key: `ms-${event.id}`,
      kind: 'milestone',
      seq: null,
      startedAt: event.created_at,
      tools: [],
      reasoning: [],
      message: '',
      text,
      cls,
      error: '',
      origin: event.kind === 'run.steered' ? 'you' : 'code',
    });
  }
  return steps;
}

export function turnSummary(step: Step): string {
  if (step.error) return `LLM call failed — ${step.error}`;
  if (step.tools.length === 0) {
    return step.seq === null
      ? 'Thinking — the model is still answering'
      : 'Thought, then answered';
  }
  const counts = new Map<string, number>();
  for (const tool of step.tools) counts.set(tool.tool, (counts.get(tool.tool) ?? 0) + 1);
  return [...counts.entries()].map(([tool, count]) => toolLabel(tool, count)).join(' · ');
}

