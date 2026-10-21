import { useState, type FormEvent } from 'react';

import { runs } from './api';
import { navigate, paths } from './route';

const LOOKS_LIKE_URL = /^(https?:\/\/|www\.)|\.[a-z]{2,}\//i;

export default function NewAnalysis({ markets, onError }: { markets: string[]; onError: (message: string) => void }) {
  const [product, setProduct] = useState('');
  const [chosen, setChosen] = useState<string[]>(['US']);
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
      <button className="primary" type="submit" disabled={busy || chosen.length === 0 || product.trim().length < 2}>
        {busy ? 'Starting…' : 'Find the product'}
      </button>
    </form>
  );
}
