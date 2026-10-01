import type { Billed, Pricing, ResearchNode, RunDetail, RunEvent } from '../api';
import { STAGE_NAMES, STAGE_NODES, scopeLabel, stageOfNode, type CollectingStage } from '../stages';

/** The stage a run collects: the server's record, else inferred from its nodes. */
export function runStage(run: { stage?: number; nodes?: readonly ResearchNode[] }): CollectingStage {
  if (run.stage === 1 || run.stage === 2 || run.stage === 3) return run.stage;
  const first = (run.nodes ?? [])[0];
  return first ? stageOfNode(first) : 1;
}

/** The "Now" panel: one glance, what is the run doing. */
export function nowPanel(
  run: RunDetail,
  live: boolean,
  lastTool: RunEvent | undefined,
): { title: string; sub: string } {
  const nodes = run.nodes ?? [];
  const stage = runStage(run);
  if (!live) {
    switch (run.status) {
      case 'completed':
        return {
          title: `Stage ${stage} complete`,
          sub: `packet accepted — ${run.counts.sources} sources, ${stage === 2 ? '' : `${run.counts.excerpts} excerpts, `}${run.counts.gaps} gaps`,
        };
      case 'invalid':
        return { title: 'Packet rejected', sub: run.error };
      case 'failed':
        return { title: 'Run failed', sub: run.error };
      case 'cancelled':
        return { title: 'Run stopped', sub: 'cancelled before the packet was written' };
      default:
        return { title: run.status, sub: '' };
    }
  }
  const where = stage === 1 && nodes.length > 0 && nodes.length < STAGE_NODES[1].length ? scopeLabel(nodes) : STAGE_NAMES[stage];
  if (lastTool) {
    const p = lastTool.payload as Record<string, string>;
    return {
      title: `Stage ${stage} · ${where} · ${p.tool ?? 'working'}`,
      sub: p.preview ?? '',
    };
  }
  return {
    title: `Stage ${stage} · ${where}`,
    sub: stage === 2 ? 'the product in isolation — code computes every number' : 'gathering only — no conclusions drawn here',
  };
}

export function pricingNote(pricing: Pricing | undefined): string {
  if (!pricing) return 'Priced before rates were recorded';
  const r = pricing.rates;
  const rates = `$${r.input ?? '?'}/$${r.output ?? '?'}/$${r.cacheRead ?? '?'} per M input/output/cache read`;
  return pricing.source === 'openrouter-live'
    ? `OpenRouter list prices fetched ${new Date(pricing.fetched_at).toLocaleString()}: ${rates}`
    : `pi-ai's bundled price snapshot, which may be stale: ${rates}`;
}

/** Billing is read back after the run settles, so "pending" is a real state. */
export function billedText(billed: Billed | undefined, live: boolean): string {
  if (!billed) return live ? 'after the run' : '—';
  const partial = billed.resolved < billed.turns ? ` (${billed.resolved} of ${billed.turns} turns)` : '';
  return `$${billed.total.toFixed(4)}${partial}`;
}
