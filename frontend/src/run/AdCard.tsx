import { useState } from 'react';

import type { ReadAd } from '../api';
import BrandMark from '../BrandMark';

function audienceOf(ad: ReadAd): string | null {
  const who = ad.audience;
  if (!who || (who.age_min === null && who.age_max === null)) return null;
  return `${who.gender && who.gender !== 'all' ? `${who.gender}, ` : ''}${who.age_min ?? '?'}–${who.age_max ?? '?'}`;
}

export default function AdCard({ ad, logo }: { ad: ReadAd; logo: string | null }) {
  const [open, setOpen] = useState(false);
  const audience = audienceOf(ad);
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
        {audience && ` · ${audience}`}
      </div>
      {ad.bucket_why && <p className="small dim">{ad.bucket_why}</p>}
      {ad.reading?.relation_why && <p className="small">{ad.reading.relation_why}</p>}
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
