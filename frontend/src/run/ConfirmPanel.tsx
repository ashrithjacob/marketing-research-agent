import { useState, type FormEvent } from 'react';

import { runs, type BrandVisual, type CompetitorPick, type Resolution } from '../api';
import PickTile from './PickTile';

export default function ConfirmPanel({ runId, resolution, visuals, onDone, onError }: { runId: string; resolution: Resolution; visuals: Record<string, BrandVisual>; onDone: () => void; onError: (message: string) => void }) {
  const candidates = [{ name: resolution.product.name, url: resolution.product.url, brand: resolution.product.brand }, ...resolution.alternatives.map((a) => ({ ...a, brand: a.name }))];
  const [productUrl, setProductUrl] = useState(resolution.product.url);
  const [offered, setOffered] = useState<(CompetitorPick & { why: string })[]>(resolution.competitors);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(resolution.competitors.map((c) => c.url)));
  const [adding, setAdding] = useState<CompetitorPick>({ brand: '', product_name: '', url: '' });
  const [busy, setBusy] = useState(false);

  const toggle = (url: string) =>
    setChosen((now) => {
      const next = new Set(now);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });

  function add(event: FormEvent) {
    event.preventDefault();
    if (!adding.brand || !adding.url || offered.some((c) => c.url === adding.url)) return;
    setOffered((now) => [...now, { ...adding, product_name: adding.product_name || adding.brand, why: 'added by you' }]);
    setChosen((now) => new Set([...now, adding.url]));
    setAdding({ brand: '', product_name: '', url: '' });
  }

  async function confirm() {
    setBusy(true);
    try {
      const picks = offered.filter((c) => chosen.has(c.url)).map(({ brand, product_name, url }) => ({ brand, product_name, url }));
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
      <p className="dim small">Click a tile to leave it out or put it back. Nothing is spent on research until you press the button.</p>
      <h3>Product</h3>
      <ul className="pick-tiles">
        {candidates.map((candidate) => (
          <PickTile key={candidate.url} brand={candidate.brand} name={candidate.name} url={candidate.url} visual={visuals[candidate.url]} selected={productUrl === candidate.url} onToggle={() => setProductUrl(candidate.url)} />
        ))}
      </ul>
      <h3>
        Competitors to research ({chosen.size} of {offered.length})
      </h3>
      <ul className="pick-tiles">
        {offered.map((c) => (
          <PickTile key={c.url} brand={c.brand} name={c.product_name} url={c.url} visual={visuals[c.url]} selected={chosen.has(c.url)} note={c.why} onToggle={() => toggle(c.url)} />
        ))}
      </ul>
      <form className="add-competitor" onSubmit={add}>
        <input placeholder="Brand" value={adding.brand} onChange={(e) => setAdding({ ...adding, brand: e.target.value })} />
        <input placeholder="Product" value={adding.product_name} onChange={(e) => setAdding({ ...adding, product_name: e.target.value })} />
        <input placeholder="https://… product page" type="url" value={adding.url} onChange={(e) => setAdding({ ...adding, url: e.target.value })} />
        <button className="ghost" type="submit">Add</button>
      </form>
      <button className="primary" disabled={busy || chosen.size === 0} onClick={confirm}>
        {busy ? 'Starting…' : `Research this product and ${chosen.size} competitors`}
      </button>
    </section>
  );
}
