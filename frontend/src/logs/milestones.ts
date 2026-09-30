import type { RunEvent } from '../api';

/** The one line a run milestone shows on the timeline, and its colour. */
export function milestoneText(event: RunEvent): { text: string; cls: string } {
  const p = event.payload as Record<string, unknown>;
  switch (event.kind) {
    case 'run.started': {
      const nodes = (p.nodes as string[] | undefined) ?? [];
      return nodes.includes('review_mining')
        ? { text: 'Run started — stage 2, review mining', cls: '' }
        : { text: 'Run started — stage 1, gather only', cls: '' };
    }
    case 'agent.started':
      return { text: `${p.agent_id} agent started`, cls: '' };
    case 'agent.ended':
      return {
        text: `${p.agent_id} agent ended — ${p.status}${p.error ? ` (${p.error})` : ''}`,
        cls: p.status === 'complete' ? 'good' : p.status === 'incomplete' ? 'rule' : 'bad',
      };
    case 'agent.limit_reached': {
      const gapped = (p.gapped as string[] | undefined) ?? [];
      return {
        text: `${p.agent_id} agent reached its ${p.limit}-turn limit — ${gapped.length ? `gapped ${gapped.join(', ')}` : 'nothing left open'}`,
        cls: 'rule',
      };
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
        text: `Packet accepted — built from every agent's rows in the ledger — ${p.sources} sources, ${p.excerpts} excerpts, ${p.gaps} gaps`,
        cls: 'good',
      };
    case 'packet.checked': {
      const problems = (p.problems as string[] | undefined) ?? [];
      const who = p.agent_id ? `${p.agent_id}'s part` : 'Packet';
      return {
        text: p.valid
          ? `${who} checked — valid`
          : `${who} checked — ${problems.length} problem${problems.length === 1 ? '' : 's'}: ${problems[0] ?? ''}`,
        cls: p.valid ? 'good' : 'rule',
      };
    }
    case 'packet.listings':
      return p.error
        ? { text: `Amazon lookup failed — ${p.error}`, cls: 'rule' }
        : { text: `Amazon listings looked up — ${p.matched} of ${p.total} targets are on Amazon`, cls: 'good' };
    case 'run.ended_early':
      return { text: `An agent ended early (${p.error || 'no detail'}) — the ledger still passed`, cls: 'rule' };
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
