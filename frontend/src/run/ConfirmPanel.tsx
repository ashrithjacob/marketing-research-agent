import { useState, type FormEvent } from 'react';

import { runs, type CompetitorPick, type Resolution } from '../api';
import BrandMark, { domainOf } from '../BrandMark';
import { Source } from './badges';

export default function ConfirmPanel({ runId, resolution, onDone, onError }: { runId: string; resolution: Resolution; onDone: () => void; onError: (message: string) => void }) {
  const candidates = [{ name: resolution.product.name, url: resolution.product.url }, ...resolution.alternatives];
  const [productUrl, setProductUrl] = useState(resolution.product.url);
  const [picks, setPicks] = useState<CompetitorPick[]>(resolution.competitors.map(({ brand, product_name, url }) => ({ brand, product_name, url })));
  const [adding, setAdding] = useState<CompetitorPick>({ brand: '', product_name: '', url: '' });
  const [busy, setBusy] = useState(false);
  const why = new Map(resolution.competitors.map((c) => [c.url, c.why]));

  function add(event: FormEvent) {
    event.preventDefault();
    if (!adding.brand || !adding.url) return;
    setPicks((now) => [...now, { ...adding, product_name: adding.product_name || adding.brand }]);
    setAdding({ brand: '', product_name: '', url: '' });
  }

  async function confirm() {
    setBusy(true);
    try {
      await runs.confirm(runId, productUrl, picks);
      onDone();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel confirm">
      <h2>Confirm before research starts</h2>
      <h3>Product</h3>
      {candidates.map((candidate) => (
        <label key={candidate.url} className="check">
          <input type="radio" name="product" checked={productUrl === candidate.url} onChange={() => setProductUrl(candidate.url)} />
          {candidate.name} <Source url={candidate.url} />
        </label>
      ))}
      <h3>Competitors to research ({picks.length})</h3>
      <ul className="chips">
        {picks.map((pick) => (
          <li key={pick.url} className="chip" title={why.get(pick.url) ?? 'added by you'}>
            <BrandMark name={pick.brand} src={`https://${domainOf(pick.url)}/favicon.ico`} size={18} />
            <strong>{pick.brand}</strong> {pick.product_name} <Source url={pick.url} />
            <button className="ghost" aria-label={`Remove ${pick.brand}`} onClick={() => setPicks((now) => now.filter((p) => p.url !== pick.url))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <form className="add-competitor" onSubmit={add}>
        <input placeholder="Brand" value={adding.brand} onChange={(e) => setAdding({ ...adding, brand: e.target.value })} />
        <input placeholder="Product" value={adding.product_name} onChange={(e) => setAdding({ ...adding, product_name: e.target.value })} />
        <input placeholder="https://… product page" type="url" value={adding.url} onChange={(e) => setAdding({ ...adding, url: e.target.value })} />
        <button className="ghost" type="submit">Add</button>
      </form>
      <button className="primary" disabled={busy || picks.length === 0} onClick={confirm}>
        {busy ? 'Starting…' : `Research this product and ${picks.length} competitors`}
      </button>
    </section>
  );
}
