import { useState } from 'react';
import { api, type Brief, type Config, type ResearchNode, type RunSummary } from './api';
import { scopeLabel } from './StageRail';

/** Start a stage-1 run — the whole stage, or the nodes in `nodes`.
 *
 *  The brief is a product and a market — deliberately no URL field. Finding
 *  the product's own site, its reviews, its competitors and its ad-library
 *  entries is the agent's job (SearXNG to find, Firecrawl to fetch); a human
 *  pasting in a URL only anchors the run to one page.
 *
 *  A per-node run is opened from the stage rail with the brief of the run on
 *  screen already filled in, because re-running one node of a product is the
 *  usual reason to press it.
 */
export default function StartRun({
  config,
  nodes,
  initial,
  onStarted,
  onFailed,
  onClose,
}: {
  config: Config | null;
  /** Empty means the whole stage. */
  nodes: ResearchNode[];
  initial?: Brief;
  onStarted: (run: RunSummary) => Promise<void>;
  onFailed: () => Promise<void>;
  onClose: () => void;
}) {
  const [product, setProduct] = useState(initial?.product ?? '');
  const [market, setMarket] = useState(initial?.market ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const partial = nodes.length > 0;
  const reviewsInScope = !partial || nodes.includes('review_mining');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!product.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const run = await api.startRun({ product: product.trim(), market: market.trim() }, nodes);
      await onStarted(run);
    } catch (e) {
      setError((e as Error).message);
      // The run row exists and is marked failed — surface it rather than
      // losing the attempt.
      await onFailed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>{partial ? `Run ${scopeLabel(nodes)}` : 'Start run'}</h2>
        <p className="lede">
          {partial
            ? `Stage 1, ${scopeLabel(nodes)} only. The agent researches just this and records nothing for the rest of the stage.`
            : 'Stage 1 gathers raw material on a product. Name it and pick the market — the agent finds the URLs itself, by search and page fetch.'}
        </p>
        <input
          autoFocus
          placeholder="Product (e.g. MagnaCalm glycinate 400mg)"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />
        <input
          placeholder="Market (e.g. UK)"
          value={market}
          onChange={(e) => setMarket(e.target.value)}
        />
        {config && !config.corpus_mounted && (
          <p className="warn small">
            Corpus volume {config.corpus_path} is not mounted. Runs still work,
            but nothing is archived and every source becomes a gap.
          </p>
        )}
        {partial && !reviewsInScope && (
          <p className="muted small">
            The paid review tools (Amazon, Trustpilot) are not offered to this run.
          </p>
        )}
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={!product.trim() || busy}>
            {busy ? 'Starting…' : partial ? `Run ${scopeLabel(nodes)}` : 'Start run'}
          </button>
        </div>
      </form>
    </div>
  );
}
