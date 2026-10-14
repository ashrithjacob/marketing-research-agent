import { useCallback, useEffect, useState } from 'react';

import { learningApi, type AdTotals, type DraftAd } from './api';

function line(totals: AdTotals): string {
  if (totals.days === 0) return 'no days yet';
  return `$${totals.spend.toFixed(2)} over ${totals.days} days · ${totals.purchases} purchases · return on ad spend ${totals.roas === null ? '—' : totals.roas.toFixed(2)}`;
}

export default function DraftAds({ draftId, tag, onError }: { draftId: string; tag: string; onError: (message: string) => void }) {
  const [ads, setAds] = useState<DraftAd[]>([]);
  const [adId, setAdId] = useState('');

  const load = useCallback(async () => {
    try {
      setAds((await learningApi.draftAds(draftId)).data);
    } catch (err) {
      onError((err as Error).message);
    }
  }, [draftId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="draft-notes">
      <h3>The ad it became</h3>
      <p className="muted small">
        Put <code>{tag}</code> in the Meta ad's name and the ad-results watcher links it, or paste the ad id. Days settle 28 days after they happen; only settled
        days count as the draft's outcome.
      </p>
      <ul>
        {ads.map((ad) => (
          <li key={ad.ad_id}>
            Ad {ad.ad_id} <span className="muted small">linked by {ad.by === 'owner' ? 'you' : 'its name'}</span>
            <div className="d">Settled: {line(ad.settled)}</div>
            <div className="d muted">Provisional: {line(ad.provisional)}</div>
          </li>
        ))}
      </ul>
      <form
        className="always-row"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await learningApi.linkAd(draftId, adId.trim());
            setAdId('');
            await load();
          } catch (err) {
            onError((err as Error).message);
          }
        }}
      >
        <input value={adId} onChange={(e) => setAdId(e.target.value)} placeholder="Meta ad id" />
        <button className="ghost" type="submit" disabled={!adId.trim()}>
          Link
        </button>
      </form>
    </section>
  );
}
