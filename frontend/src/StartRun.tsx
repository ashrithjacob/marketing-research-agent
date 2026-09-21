import { useState } from 'react';
import { api, type Brief, type Config, type ResearchNode, type RunSummary } from './api';
import { scopeLabel } from './StageRail';

/** The markets a run covers unless you say otherwise.
 *
 *  All five are ticked when the modal opens: these are the English-language
 *  markets we sell into, and a run that wanders outside them spends its budget
 *  on sources nobody will act on. Untick what does not apply, or name something
 *  else in the free-text box — the brief is the joined list either way.
 */
export const DEFAULT_MARKETS = ['US', 'UK', 'Australia', 'New Zealand', 'Canada'] as const;

/** A bare `example.com` or a full `https://…`, with no spaces in it.
 *  Mirrors `looksLikeUrl` in server/src/schema.ts — the server normalises the
 *  brief too, so a script posting straight to the API gets the same treatment. */
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

/** Start a stage-1 run — the whole stage, or the nodes in `nodes`.
 *
 *  The brief is a product and its markets — deliberately no URL field. Finding
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
  // A re-run keeps the brief it is re-running; a fresh run gets the five.
  const from = initial?.market ? splitMarkets(initial.market) : null;
  // A site brief has no product name, so the url is what the re-run carries.
  // Typing it back in means it is re-detected and lands in `url` again.
  const [product, setProduct] = useState(initial?.product || initial?.url || '');
  const [ticked, setTicked] = useState<string[]>(from ? from.ticked : [...DEFAULT_MARKETS]);
  const [other, setOther] = useState(from?.other ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const partial = nodes.length > 0;
  const reviewsInScope = !partial || nodes.includes('review_mining');
  const isUrl = looksLikeUrl(product);
  // Ticks first, in the order they are shown, so the same choice reads the same
  // way twice. Free text is split on commas and deduped against the ticks.
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
      // A url goes in `url`, never in `product`: `product` is a name, and the
      // agent's first job on a site brief is to read that name off the page.
      const typed = product.trim();
      const brief = isUrl
        ? { product: '', url: /^https?:\/\//i.test(typed) ? typed : `https://${typed}`, market }
        : { product: typed, market };
      const run = await api.startRun(brief, nodes);
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
            : 'Stage 1 gathers raw material on a product. Name it and pick the markets — the agent finds the URLs itself, by search and page fetch.'}
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
        {partial && !reviewsInScope && (
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
