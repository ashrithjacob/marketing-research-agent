import { useState } from 'react';

import type { Competitor, ReadAd } from '../api';
import BrandMark from '../BrandMark';

const BUCKETS = ['winning', 'testing', 'dead'] as const;

function AdCard({ ad, logo }: { ad: ReadAd; logo: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="ad">
      {ad.media_url && <img src={ad.media_url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <div className="competitor-head">
        <BrandMark name={ad.advertiser} src={logo} size={22} />
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

export default function Ads({ ads, competitors }: { ads: ReadAd[]; competitors: Competitor[] }) {
  const [bucket, setBucket] = useState<string>('all');
  const logo = (ad: ReadAd) => {
    const owner = competitors.find((c) => c.id === ad.competitor_id);
    return owner?.logo_url ?? owner?.image_url ?? null;
  };

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
          <AdCard key={ad.id} ad={ad} logo={logo(ad)} />
        ))}
      </ul>
    </section>
  );
}
