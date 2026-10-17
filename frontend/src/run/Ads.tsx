import { useEffect, useState } from 'react';

import { runs, type ReadAd } from '../api';

const BUCKETS = ['winning', 'testing', 'dead'] as const;

function AdCard({ ad }: { ad: ReadAd }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="ad">
      {ad.media_url && <img src={ad.media_url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <div className="competitor-head">
        <strong>{ad.advertiser}</strong>
        {ad.bucket && <span className={`badge bucket-${ad.bucket}`}>{ad.bucket}</span>}
      </div>
      <div className="dim small">
        {ad.landing_domain} · {ad.days_running ?? '?'} days · {ad.duplicates ?? '?'} duplicates · {ad.status}
      </div>
      {ad.bucket_why && <p className="small dim">{ad.bucket_why}</p>}
      {ad.reading && (
        <p className="small">
          <strong>{ad.reading.claim_type}</strong>, {ad.reading.awareness.replace('_', ' ')} · {ad.reading.avatar}
          {ad.reading.mechanism && <> · mechanism: {ad.reading.mechanism}</>}
          {ad.reading.risk_flags.length > 0 && <span className="error"> · risk: {ad.reading.risk_flags.join('; ')}</span>}
        </p>
      )}
      <p className="small copy">{open ? ad.copy : `${ad.copy.slice(0, 280)}…`}</p>
      <button className="ghost small" onClick={() => setOpen(!open)}>
        {open ? 'Less' : `Read all ${ad.copy.length} characters`}
      </button>
    </li>
  );
}

export default function Ads({ runId, version, onError }: { runId: string; version: string; onError: (message: string) => void }) {
  const [ads, setAds] = useState<ReadAd[]>([]);
  const [bucket, setBucket] = useState<string>('all');

  useEffect(() => {
    runs.ads(runId).then((r) => setAds(r.ads), (e: Error) => onError(e.message));
  }, [runId, version, onError]);

  if (ads.length === 0) return null;
  const shown = bucket === 'all' ? ads : ads.filter((ad) => ad.bucket === bucket);
  return (
    <section className="panel">
      <h2>Competitor long-form statics</h2>
      <div className="filters">
        {['all', ...BUCKETS].map((name) => (
          <button key={name} className={`chip ${bucket === name ? 'on' : ''}`} onClick={() => setBucket(name)}>
            {name} ({name === 'all' ? ads.length : ads.filter((ad) => ad.bucket === name).length})
          </button>
        ))}
      </div>
      <ul className="cards ads">
        {shown.map((ad) => (
          <AdCard key={ad.id} ad={ad} />
        ))}
      </ul>
    </section>
  );
}
