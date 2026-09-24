import type { RunEvent } from '../api';

export interface ToolRow {
  key: string;
  tool: string;
  lane: string;
  preview: string;
  state: 'running' | 'done' | 'error';
  duration?: number;
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
}
const TOOL_VERBS: Record<string, string> = {
  web_search: 'Searched the web',
  web_fetch: 'Read a page',
  validate_packet: 'Checked the packet against the stage-1 contract',
  corpus_write: 'Filed material into the corpus',
  corpus_read: 'Read material back from the corpus',
};

export function toolVerb(tool: string): string {
  return TOOL_VERBS[tool] ?? tool.replace(/_/g, ' ');
}

function toolLabel(tool: string, count: number): string {
  if (tool === 'web_search') return `${count} search${count === 1 ? '' : 'es'}`;
  if (tool === 'web_fetch') return `read ${count} page${count === 1 ? '' : 's'}`;
  if (tool === 'validate_packet') return 'packet check';
  return `${count} × ${tool.replace(/_/g, ' ')}`;
}

function milestoneText(event: RunEvent): { text: string; cls: string } {
  const p = event.payload as Record<string, unknown>;
  switch (event.kind) {
    case 'run.started':
      return { text: 'Run started — stage 1, gather only', cls: '' };
    case 'run.steered':
      return { text: `Your correction landed mid-run — ${p.text ?? ''}`, cls: 'rule' };
    case 'run.nudged':
      return { text: 'The run ended without a packet — asked once more, tools off', cls: 'rule' };
    case 'run.resumed':
      return {
        text: `The model stream dropped (${p.error || 'no detail'}) — retry ${p.attempt ?? 1} of 3`,
        cls: 'rule',
      };
    case 'packet.ready':
      return {
        text: `Packet accepted — ${p.sources} sources, ${p.excerpts} excerpts, ${p.gaps} gaps`,
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

/** Events → boxes. An `llm.call` opens a turn; its tools and reasoning hang under it. */
export function buildSteps(events: RunEvent[]): Step[] {
  const steps: Step[] = [];
  let turn: Step | null = null;
  const running = new Map<string, ToolRow[]>();

  const startRow = (tool: string, row: ToolRow) => {
    const queue = running.get(tool) ?? [];
    queue.push(row);
    running.set(tool, queue);
  };
  /** No correlation id upstream: a completion settles the oldest running call for that tool. */
  const settleRow = (tool: string, error: unknown, duration: unknown) => {
    const queue = running.get(tool) ?? [];
    const row = queue.find((r) => r.state === 'running');
    if (!row) return;
    row.state = error ? 'error' : 'done';
    row.duration = Number(duration ?? 0);
    running.set(
      tool,
      queue.filter((r) => r.state === 'running'),
    );
  };

  for (const event of events) {
    const p = event.payload as Record<string, unknown>;
    if (event.kind === 'llm.call') {
      turn = {
        key: `turn-${event.id}`,
        kind: 'turn',
        seq: Number(p.seq),
        startedAt: event.created_at,
        tools: [],
        reasoning: [],
        message: '',
        text: '',
        cls: '',
        error: String(p.error ?? ''),
      };
      steps.push(turn);
      continue;
    }
    if (event.kind === 'tool.started') {
      const row: ToolRow = {
        key: `${event.id}`,
        tool: String(p.tool ?? ''),
        lane: String(p.lane ?? 'other'),
        preview: String(p.preview ?? ''),
        state: 'running',
      };
      startRow(row.tool, row);
      if (turn) turn.tools.push(row);
      continue;
    }
    if (event.kind === 'tool.completed') {
      settleRow(String(p.tool ?? ''), p.error, p.duration);
      continue;
    }
    if (event.kind === 'reasoning.available') {
      if (turn) turn.reasoning.push(String(p.text ?? ''));
      continue;
    }
    if (event.kind === 'message.delta') {
      if (turn) turn.message += String(p.delta ?? '');
      continue;
    }
    if (event.kind === 'run.billed' && turn && steps.length > 0) {
      continue;
    }
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
    });
  }
  return steps;
}

export function turnSummary(step: Step): string {
  if (step.error) return `LLM call failed — ${step.error}`;
  if (step.tools.length === 0) return 'Thought, then answered';
  const counts = new Map<string, number>();
  for (const tool of step.tools) counts.set(tool.tool, (counts.get(tool.tool) ?? 0) + 1);
  return [...counts.entries()].map(([tool, count]) => toolLabel(tool, count)).join(' · ');
}

