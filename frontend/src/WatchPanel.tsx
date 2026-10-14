import { useCallback, useEffect, useState } from 'react';

import { learningApi, type AdAccount, type WatchedBrand } from './api';

export default function WatchPanel({ onError }: { onError: (message: string) => void }) {
  const [brands, setBrands] = useState<WatchedBrand[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [term, setTerm] = useState('');
  const [account, setAccount] = useState('');

  const load = useCallback(async () => {
    try {
      setBrands((await learningApi.watchedBrands()).data);
      setAccounts((await learningApi.adAccounts()).data);
    } catch (err) {
      onError((err as Error).message);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(work: () => Promise<unknown>) {
    try {
      await work();
      await load();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  const domain = term.includes('.');
  return (
    <section className="always">
      <h2>Watching</h2>
      <p className="muted small">With Always on, the watchers look daily for new ads from these competitors (Trendtrack credits, inside the daily cap), and every six hours read your Meta ad results.</p>
      <h3>Competitors</h3>
      <ul>
        {brands.map((b) => (
          <li key={b.id}>
            {b.term} <span className="muted small">by {b.search_in}{b.checked_at ? `, checked ${new Date(b.checked_at).toLocaleDateString()}` : ', not checked yet'}</span>
            <button className="ghost" onClick={() => act(() => learningApi.removeWatchedBrand(b.id))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form className="always-row" onSubmit={(e) => { e.preventDefault(); if (term.trim()) void act(async () => { await learningApi.addWatchedBrand(term.trim(), domain ? 'domain' : 'brand'); setTerm(''); }); }}>
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Brand name or domain" />
        <button className="ghost" type="submit">Watch</button>
      </form>
      <h3>Meta ad accounts</h3>
      <ul>
        {accounts.map((a) => (
          <li key={a.account_id}>
            act_{a.account_id} <span className={`status ${a.status === 'connected' ? 'completed' : 'cancelled'}`}>{a.status === 'connected' ? 'connected' : 'reconnect needed'}</span>
            <span className="muted small">{a.read_at ? ` read ${new Date(a.read_at).toLocaleString()}` : ' not read yet'}{a.error ? ` · ${a.error}` : ''}</span>
            <button className="ghost" onClick={() => act(() => learningApi.disconnectAdAccount(a.account_id))}>
              Disconnect
            </button>
          </li>
        ))}
      </ul>
      <form className="always-row" onSubmit={(e) => { e.preventDefault(); if (account.trim()) void act(async () => { await learningApi.connectAdAccount(account.trim()); setAccount(''); }); }}>
        <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Ad account id, e.g. act_1234567890" />
        <button className="ghost" type="submit">Connect</button>
      </form>
    </section>
  );
}
