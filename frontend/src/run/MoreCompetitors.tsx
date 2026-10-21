import { useState, type FormEvent } from 'react';

import { competitors as api, FINAL_STATUSES, type Candidate, type CompetitorPick, type RunEvent, type RunView } from '../api';
import { domainOf } from '../BrandMark';
import PickTile from './PickTile';

export default function MoreCompetitors({ view, events, onDone, onError }: { view: RunView; events: RunEvent[]; onDone: () => void; onError: (message: string) => void }) {
  const [added, setAdded] = useState<Candidate[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<CompetitorPick>({ brand: '', product_name: '', url: '' });
  const [busy, setBusy] = useState(false);
  const finished = FINAL_STATUSES.has(view.run.status);
  const work = api.work(events, !finished);
  const offered = [...api.candidates(view), ...added.filter((c) => !api.candidates(view).some((o) => o.url === c.url))];
  const picks = offered.filter((c) => chosen.has(c.url));
  const shopOf = (url: string) => (/\/products\//.test(url) ? view.signals[domainOf(url)] : undefined);

  const toggle = (url: string) =>
    setChosen((now) => {
      const next = new Set(now);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });

  function addByUrl(event: FormEvent) {
    event.preventDefault();
    if (!adding.brand || !adding.url || offered.some((c) => c.url === adding.url)) return;
    setAdded((now) => [...now, { ...adding, product_name: adding.product_name || adding.brand, why: 'added by you' }]);
    setChosen((now) => new Set([...now, adding.url]));
    setAdding({ brand: '', product_name: '', url: '' });
  }

  async function act(call: () => Promise<unknown>) {
    setBusy(true);
    try {
      await call();
      setChosen(new Set());
      setAdded([]);
      onDone();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="more-competitors" className="panel confirm">
      <h2>More competitors</h2>
      {work.working && <p className="dim">{work.working === 'search' ? 'Searching for competitors this run does not have…' : 'Profiling the added competitors and collecting their reviews…'}</p>}
      {work.searched && <p className="small">{work.searched.error ? <span className="error">The search found nothing usable: {work.searched.error}</span> : `The search proposed ${work.searched.found} more.`}</p>}
      {work.added && (
        <div className="small">
          <p>Added {work.added.competitors.join(', ')}. {work.added.lines.join(' · ')}</p>
          <p className="dim">Market awareness and Avatars ran before these were added. Rerun them from the Overview to include them.</p>
        </div>
      )}
      <p className="dim small">
        {offered.length > 0 ? `Proposed for this run but not researched (${offered.length}). Click a tile to pick it.` : 'Every competitor proposed for this run is researched.'} Picked competitors are profiled and their reviews collected; the brief and the competitors already researched are kept as they are.
      </p>
      {offered.length > 0 && (
        <ul className="pick-tiles">
          {offered.map((c) => (
            <PickTile key={c.url} brand={c.brand} name={c.product_name} url={c.url} visual={view.visuals[c.url]} signals={shopOf(c.url)} selected={chosen.has(c.url)} note={c.why} onToggle={() => toggle(c.url)} />
          ))}
        </ul>
      )}
      <form className="add-competitor" onSubmit={addByUrl}>
        <input placeholder="Brand" value={adding.brand} onChange={(e) => setAdding({ ...adding, brand: e.target.value })} />
        <input placeholder="Product" value={adding.product_name} onChange={(e) => setAdding({ ...adding, product_name: e.target.value })} />
        <input placeholder="https://… product page" type="url" value={adding.url} onChange={(e) => setAdding({ ...adding, url: e.target.value })} />
        <button className="ghost" type="submit">Add</button>
      </form>
      <div className="row">
        <button className="primary" disabled={!finished || busy || picks.length === 0} onClick={() => act(() => api.add(view.run.id, picks.map(({ brand, product_name, url }) => ({ brand, product_name, url }))))}>
          {picks.length === 0 ? 'Pick competitors to research' : `Research ${picks.length} competitor${picks.length === 1 ? '' : 's'} (about $${(picks.length * 0.09).toFixed(2)})`}
        </button>
        <button className="ghost" disabled={!finished || busy} onClick={() => act(() => api.search(view.run.id))}>
          Search for more (about $0.03)
        </button>
      </div>
    </section>
  );
}
