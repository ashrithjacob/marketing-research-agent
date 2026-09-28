import { useMemo, useState } from 'react';
import { gridColumns, issueIndex, productSide, productsIn, quotesFor, sliceOf, type ReviewAnalysis } from '../../api';
import { Chip, Tile } from '../tile';
import { IssueGrid } from './IssueGrid';
import { IssueList, type IssueRow } from './IssueList';
import { StarSpread } from './StarSpread';
import { useReviewAnalysis } from './use-review-analysis';
import { VoiceFilters, type VoiceFilter } from './VoiceFilters';

export function VoiceAnalysis({ runId, finished }: { runId: string; finished: boolean }) {
  const { analysis, loaded, error, start } = useReviewAnalysis(runId);
  const [open, setOpen] = useState(true);
  const running = analysis?.status === 'running';
  const done = analysis?.status === 'done' ? analysis : null;

  return (
    <Tile
      label="Customer voice"
      sub="the biggest issues and gaps, from real reviews"
      open={open}
      onToggle={() => setOpen((o) => !o)}
      chips={
        <>
          {done && <Chip>{done.cleaning.kept} reviews analysed</Chip>}
          {running && <Chip tone="accent">analysing…</Chip>}
          {analysis?.status === 'failed' && <Chip tone="warn">failed</Chip>}
        </>
      }
    >
      {error && <div className="error">{error}</div>}
      {!loaded && <p className="muted">Loading…</p>}
      {loaded && !running && (
        <div className="voice-start">
          <button className={done ? 'ghost' : 'primary'} disabled={!finished} onClick={() => void start()}>
            {done ? 'Re-run analysis' : 'Analyse reviews'}
          </button>
          <span className="muted">
            {finished
              ? 'Cleans the mined reviews, groups them into issues and ranks them. A few LLM calls; no Apify.'
              : 'Available once the run has finished mining.'}
          </span>
        </div>
      )}
      {analysis?.status === 'failed' && <div className="error">Analysis failed: {analysis.error}</div>}
      {running && <p className="muted">Reading every review in bulk batches — usually under two minutes.</p>}
      {done && <Findings analysis={done} />}
    </Tile>
  );
}

function Findings({ analysis }: { analysis: ReviewAnalysis }) {
  const [filter, setFilter] = useState<VoiceFilter>({ source: 'all', group: 'product', target: '' });
  const index = useMemo(() => issueIndex(analysis), [analysis]);
  const products = productsIn(analysis, filter.source, filter.group);
  const product = products.find((p) => p.target_id === filter.target);
  const ranked = sliceOf(analysis, filter.source, filter.group)?.ranked ?? [];
  const rows = (side: 'worst' | 'best'): IssueRow[] => {
    const wanted = (id: string) => (index.get(id)?.kind === 'praise') === (side === 'best');
    const picked: Array<{ issue_id: string; mentions: number; score: number; share?: number; quotes: string[] }> = product
      ? productSide(analysis, product, side, 6)
      : ranked.filter((r) => wanted(r.issue_id)).slice(0, 6);
    return picked.flatMap(({ issue_id, quotes, ...rest }) => {
      const issue = index.get(issue_id);
      return issue ? [{ ...rest, issue, quotes: quotesFor(analysis, quotes) }] : [];
    });
  };
  const c = analysis.cleaning;

  return (
    <div className="voice">
      <p className="voice-clean">
        {c.fetched} reviews mined → removed {c.duplicates} duplicate{c.duplicates === 1 ? '' : 's'},{' '}
        {c.empty} with under three words, {c.off_product} about a different product
        {c.untagged > 0 && `, ${c.untagged} the model failed to read`} → <b>{c.kept} analysed</b>.
        Ranked by mentions × severity, with 3★ reviews weighted {analysis.star_weights['3']}×, 2★ and 4★{' '}
        {analysis.star_weights['2']}×, 1★ and 5★ {analysis.star_weights['1']}×.{' '}
        <span className="muted">
          {analysis.llm_calls} LLM calls · ${analysis.cost_usd.toFixed(3)} · {analysis.model}
        </span>
      </p>

      <VoiceFilters analysis={analysis} filter={filter} products={products} onChange={setFilter} />

      <div className="voice-sides">
        <section>
          <h4>Worst — complaints and gaps</h4>
          <IssueList rows={rows('worst')} tone="worst" />
        </section>
        <section>
          <h4>Best — what customers value</h4>
          <IssueList rows={rows('best')} tone="best" />
        </section>
      </div>

      <h4>Where each product is weak</h4>
      <IssueGrid analysis={analysis} products={products} columns={gridColumns(analysis, ranked)} />

      <h4>Star spread</h4>
      <StarSpread products={products} />
    </div>
  );
}
