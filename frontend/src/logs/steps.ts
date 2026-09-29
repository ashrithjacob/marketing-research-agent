import type { RunEvent, ServiceReport, ToolStep } from '../api';

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
  finish: 'Built the packet from the ledger and checked it against the contract',
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

function milestoneText(event: RunEvent): { text: string; cls: string } {
  const p = event.payload as Record<string, unknown>;
  switch (event.kind) {
    case 'run.started': {
      const nodes = (p.nodes as string[] | undefined) ?? [];
      return nodes.includes('review_mining')
        ? { text: 'Run started — stage 2, review mining', cls: '' }
        : { text: 'Run started — stage 1, gather only', cls: '' };
    }
    case 'run.steered':
      return { text: `Your correction landed mid-run — ${p.text ?? ''}`, cls: 'rule' };
    case 'run.nudged':
      return { text: 'The run ended without a packet — asked once more, tools off', cls: 'rule' };
    case 'run.resumed':
      return {
        text: `The model stream dropped (${p.error || 'no detail'}) — the code waited ${(Number(p.delay_ms ?? 0) / 1000).toFixed(1)}s and ${p.to ? `moved from ${p.from} to the next model in .env, ${p.to}` : 'asked the same model to carry on'}, retry ${p.attempt ?? 1} of 3`,
        cls: 'rule',
      };
    case 'packet.ready':
      return {
        text: `Packet accepted${p.via === 'ledger' ? ' — built from the ledger on the agent\u2019s behalf' : ''} — ${p.sources} sources, ${p.excerpts} excerpts, ${p.gaps} gaps`,
        cls: 'good',
      };
    case 'packet.checked': {
      const problems = (p.problems as string[] | undefined) ?? [];
      return {
        text: p.valid
          ? 'Packet checked — valid, this is the run’s result'
          : `Packet checked — ${problems.length} problem${problems.length === 1 ? '' : 's'}: ${problems[0] ?? ''}`,
        cls: p.valid ? 'good' : 'rule',
      };
    }
    case 'packet.listings':
      return p.error
        ? { text: `Amazon lookup failed — ${p.error}`, cls: 'rule' }
        : { text: `Amazon listings looked up — ${p.matched} of ${p.total} targets are on Amazon`, cls: 'good' };
    case 'run.ended_early':
      return { text: `The run ended early (${p.error || 'no detail'}) — the packet was already validated`, cls: 'rule' };
    case 'packet.invalid':
      return { text: `Packet rejected — ${p.error ?? ''}`, cls: 'bad' };
    case 'run.failed':
      return { text: `Run failed — ${p.error ?? ''}`, cls: 'bad' };
    case 'run.completed':
      return { text: 'Run completed', cls: 'good' };
    case 'run.billed': {
      const billed = p.billed as { total: number; resolved: number; turns: number };
      return {
        text: `OpenRouter billed $${billed.total.toFixed(4)} — ${billed.resolved} of ${billed.turns} turns read back`,
        cls: '',
      };
    }
    default:
      return { text: event.kind, cls: '' };
  }
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

