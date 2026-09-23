import type { Billed, Pricing, RunDetail, RunEvent } from '../api';
import { NODE_ORDER, scopeLabel } from '../StageRail';

/** The "Now" panel: one glance, what is the run doing. */
export function nowPanel(
  run: RunDetail,
  live: boolean,
  lastTool: RunEvent | undefined,
): { title: string; sub: string } {
  if (!live) {
    switch (run.status) {
      case 'completed':
        return {
          title: 'Run complete',
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
    run.nodes && run.nodes.length < NODE_ORDER.length ? scopeLabel(run.nodes) : 'Raw material';
  if (lastTool) {
    const p = lastTool.payload as Record<string, string>;
    return {
      title: `Stage 1 · ${where} · ${p.tool ?? 'working'}`,
      sub: p.preview ?? '',
    };
  }
  return {
    title: `Stage 1 · ${where}`,
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
