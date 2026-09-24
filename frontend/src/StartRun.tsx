import { useState } from 'react';
import { api, type Brief, type Config, type ResearchNode, type RunSummary } from './api';
import { scopeLabel } from './StageRail';

/** The markets a run covers unless you say otherwise — the English-language markets sold into. */
export const DEFAULT_MARKETS = ['US', 'UK', 'Australia', 'New Zealand', 'Canada'] as const;

/** A url-shaped string, no spaces. Mirrors `Briefs.looksLikeUrl` in `server/src/domain/brief.ts`. */
const URL_LIKE = /^(https?:\/\/\S+|(?!.*\s)[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?)$/i;

export function looksLikeUrl(value: string): boolean {
  return URL_LIKE.test(value.trim());
}

/** Split a stored brief's market string back into ticks and free text. */
export function splitMarkets(market: string): { ticked: string[]; other: string } {
  const parts = market
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const known = new Set<string>(DEFAULT_MARKETS);
  return {
    ticked: parts.filter((p) => known.has(p)),
    other: parts.filter((p) => !known.has(p)).join(', '),
  };
}

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
  const from = initial?.market ? splitMarkets(initial.market) : null;
  const [product, setProduct] = useState(initial?.product || initial?.url || '');
  const [ticked, setTicked] = useState<string[]>(from ? from.ticked : [...DEFAULT_MARKETS]);
  const [other, setOther] = useState(from?.other ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const partial = nodes.length > 0;
  const isUrl = looksLikeUrl(product);
  const market = [
    ...DEFAULT_MARKETS.filter((m) => ticked.includes(m)),
    ...other.split(',').map((part) => part.trim()),
  ]
    .filter((part, i, all) => part && all.indexOf(part) === i)
    .join(', ');

  function toggle(name: string) {
    setTicked((current) =>
      current.includes(name) ? current.filter((m) => m !== name) : [...current, name],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!product.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const typed = product.trim();
      const brief = isUrl
        ? { product: '', url: /^https?:\/\//i.test(typed) ? typed : `https://${typed}`, market }
        : { product: typed, market };
      const run = await api.startRun(brief, nodes);
      await onStarted(run);
    } catch (e) {
      setError((e as Error).message);
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
        <h2>{nodes.length === 0 ? 'Start run' : `Run ${scopeLabel(nodes)}`}</h2>
        <p className="lede">
          {partial
            ? `Stage 1, ${scopeLabel(nodes)} only. The agent researches just this and records nothing for the rest of the stage.`
            : 'Stage 1 gathers the product, its competitors and its category. Name the product and pick the markets — the agent finds the URLs itself, by search and page fetch. Review mining is stage 2, started from the rail once this finishes.'}
        </p>
        <input
          autoFocus
          placeholder="Product name, or the site's URL"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />
        {isUrl && (
          <p className="muted small">
            Read as a site, not a product name. The agent fetches it first and
            names the product from the page itself.
          </p>
        )}
        <fieldset className="markets">
          <legend>Markets</legend>
          {DEFAULT_MARKETS.map((name) => (
            <label key={name} className="market">
              <input
                type="checkbox"
                id={`market-${name.replace(/\s+/g, '-').toLowerCase()}`}
                checked={ticked.includes(name)}
                onChange={() => toggle(name)}
              />
              {name}
            </label>
          ))}
        </fieldset>
        <input
          id="market-other"
          placeholder="Also / instead (e.g. Ireland, Germany)"
          value={other}
          onChange={(e) => setOther(e.target.value)}
        />
        <p className="muted small">
          {market
            ? `The run records only ${market}. A source from anywhere else is out of scope.`
            : 'No market set — the agent researches anywhere it finds material.'}
        </p>
        {config && !config.corpus_mounted && (
          <p className="warn small">
            Corpus volume {config.corpus_path} is not mounted. Runs still work,
            but nothing is archived and every source becomes a gap.
          </p>
        )}
        {partial && (
          <p className="muted small">
            {nodes.includes('competitors')
              ? 'Amazon product search is offered for finding competitors (Apify, about $0.012 a result). The paid review tools are not.'
              : 'The paid review tools (Amazon, Trustpilot) are not offered to this run.'}
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
