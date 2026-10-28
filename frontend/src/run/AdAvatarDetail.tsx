import { useState } from 'react';

import type { ReadAd, StoredAvatar } from '../api';
import ProfileList from './ProfileList';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

function Advertisers({ ads }: { ads: ReadAd[] }) {
  const counts = [...ads.reduce((m, ad) => m.set(ad.advertiser, (m.get(ad.advertiser) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  if (counts.length === 0) return null;
  return (
    <section className="detail-block">
      <h3>Who is writing to them</h3>
      <ul className="sub-rows">
        {counts.map(([advertiser, n]) => (
          <li key={advertiser} className="sub-row static">
            <span className="sub-name">{advertiser}</span>
            <span className="gap-bar"><span style={{ width: pct(n / ads.length), background: 'var(--series-1)' }} /></span>
            <span className="small dim">{n} ads</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WhySameBuyer({ avatar, buyer }: { avatar: StoredAvatar; buyer: string | null }) {
  const why = avatar.profile.same_buyer;
  if (!why) return null;
  return (
    <section className="detail-block same-buyer-why">
      <h3>Why this is your buyer</h3>
      <p>{buyer ? <><strong>{buyer}.</strong> </> : null}{why.shared}</p>
      <ProfileList label="What carries over to your product" items={why.borrow} first={4} />
    </section>
  );
}

function Examples({ ads, first }: { ads: ReadAd[]; first: string[] }) {
  const [all, setAll] = useState(false);
  const ordered = [...ads].sort((a, b) => Number(first.includes(b.id)) - Number(first.includes(a.id)) || (b.days_running ?? 0) - (a.days_running ?? 0));
  if (ordered.length === 0) return null;
  return (
    <section className="detail-block">
      <h3>Their ads</h3>
      <ul className="quotes">
        {(all ? ordered : ordered.slice(0, 2)).map((ad) => (
          <li key={ad.id} className="small">“{ad.copy.replace(/\s+/g, ' ').slice(0, 260)}…” <span className="dim">{ad.advertiser}, {ad.days_running ?? '?'} days{ad.bucket ? `, ${ad.bucket}` : ''}</span></li>
        ))}
      </ul>
      {ordered.length > 2 && <button className="link small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `+${ordered.length - 2} more ads`}</button>}
    </section>
  );
}

export default function AdAvatarDetail({ avatar, ads, market, buyer, onBack }: { avatar: StoredAvatar; ads: ReadAd[]; market: string; buyer: string | null; onBack: () => void }) {
  const advertisers = new Set(ads.map((ad) => ad.advertiser)).size;
  return (
    <section className="panel avatar-detail">
      <nav className="crumbs small" aria-label="Breadcrumb">
        <button className="link" onClick={onBack}>All ad avatars</button> › {market} › <span>{avatar.name}</span>
      </nav>
      <div className="competitor-head">
        <h2>{avatar.name}</h2>
        {avatar.standing === 'emerging' && <span className="badge">emerging</span>}
      </div>
      {avatar.description && <p>{avatar.description}</p>}
      <div className="tiles">
        <div className="tile"><strong className="tile-value">{avatar.ad_count}</strong><span className="small dim">ads, {pct(avatar.supply_share)} of segmented ads</span></div>
        <div className="tile"><strong className="tile-value">{pct(avatar.win_rate)}</strong><span className="small dim">of its ads winning</span></div>
        <div className="tile"><strong className="tile-value">{advertisers}</strong><span className="small dim">advertisers</span></div>
        <div className="tile"><strong className="tile-value">{Math.max(0, ...ads.map((ad) => ad.days_running ?? 0))}</strong><span className="small dim">days, its longest-running ad</span></div>
      </div>
      <WhySameBuyer avatar={avatar} buyer={buyer} />
      <Advertisers ads={ads} />
      <div className="profile-grid">
        <ProfileList label="Pains" items={avatar.profile.pains} />
        <ProfileList label="Desires" items={avatar.profile.desires} />
        <ProfileList label="Triggers" items={avatar.profile.triggers} />
        <ProfileList label="Objections" items={avatar.profile.objections} />
        <ProfileList label="Angles" items={avatar.profile.angles} />
      </div>
      <Examples ads={ads} first={avatar.profile.quote_ad_ids ?? []} />
    </section>
  );
}
