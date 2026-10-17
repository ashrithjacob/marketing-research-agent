import { useState, type FormEvent } from 'react';

import { runs } from './api';
import { navigate, paths } from './route';

const LOOKS_LIKE_URL = /^(https?:\/\/|www\.)|\.[a-z]{2,}\//i;

export default function NewAnalysis({ markets, onError }: { markets: string[]; onError: (message: string) => void }) {
  const [product, setProduct] = useState('');
  const [chosen, setChosen] = useState<string[]>(['US']);
  const [competitors, setCompetitors] = useState('');
  const [constraints, setConstraints] = useState('');
  const [offer, setOffer] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (market: string) => setChosen((now) => (now.includes(market) ? now.filter((m) => m !== market) : [...now, market]));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const typed = product.trim();
    const asUrl = LOOKS_LIKE_URL.test(typed);
    setBusy(true);
    try {
      const { run } = await runs.start({
        product_url: asUrl ? (typed.startsWith('http') ? typed : `https://${typed}`) : null,
        product_name: asUrl ? null : typed,
        markets: chosen,
        known_competitors: competitors.split(/\n|,/).map((c) => c.trim()).filter(Boolean),
        brand_constraints: constraints,
        price_offer: offer,
      });
      navigate(paths.run(run.id));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="new-analysis" onSubmit={submit}>
      <label>
        Product url or name
        <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="mullevia.com/products/mullevia-mullein-drops or mullein lung drops" required />
      </label>
      <fieldset className="markets">
        <legend>Markets</legend>
        {markets.map((market) => (
          <label key={market} className="check">
            <input type="checkbox" checked={chosen.includes(market)} onChange={() => toggle(market)} />
            {market}
          </label>
        ))}
      </fieldset>
      <details>
        <summary>Optional context</summary>
        <label>
          Known competitors, one per line
          <textarea rows={3} value={competitors} onChange={(e) => setCompetitors(e.target.value)} />
        </label>
        <label>
          Claims the brand can and cannot make, voice notes
          <textarea rows={3} value={constraints} onChange={(e) => setConstraints(e.target.value)} />
        </label>
        <label>
          Price and offer
          <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="€32.95, 2+1 and 3+2 bundles, subscription" />
        </label>
      </details>
      <button className="primary" type="submit" disabled={busy || chosen.length === 0 || product.trim().length < 2}>
        {busy ? 'Starting…' : 'Find the product'}
      </button>
    </form>
  );
}
