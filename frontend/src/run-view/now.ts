import type { Billed, Pricing, RunDetail, RunEvent } from '../api';
import { STAGE_NODES, scopeLabel } from '../StageRail';

/** The stage a run collects: the server's record, else inferred from its nodes. */
export function runStage(run: { stage?: number; nodes?: readonly string[] }): 1 | 2 {
  if (run.stage === 1 || run.stage === 2) return run.stage;
  return (run.nodes ?? []).includes('review_mining') ? 2 : 1;
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
          sub: `packet accepted — ${run.counts.sources} sources, ${run.counts.excerpts} excerpts, ${run.counts.gaps} gaps`,
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
  const where =
    stage === 2
      ? 'Review mining'
      : nodes.length > 0 && nodes.length < STAGE_NODES[1].length
        ? scopeLabel(nodes)
        : 'Raw material';
  if (lastTool) {
    const p = lastTool.payload as Record<string, string>;
    return {
      title: `Stage ${stage} · ${where} · ${p.tool ?? 'working'}`,
      sub: p.preview ?? '',
    };
  }
  return {
    title: `Stage ${stage} · ${where}`,
    sub: 'gathering only — no conclusions drawn here',
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
