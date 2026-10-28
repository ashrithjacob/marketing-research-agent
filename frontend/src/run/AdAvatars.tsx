import { useState } from 'react';

import type { ReadAd, StoredAvatar } from '../api';
import AdAvatarDetail from './AdAvatarDetail';
import StackedBar from './StackedBar';

const MARKETS: { key: 'client_market' | 'same_buyer'; title: string; note: string }[] = [
  { key: 'client_market', title: 'Lung market', note: 'Who direct competitors and same-problem products are writing to.' },
  { key: 'same_buyer', title: 'Same buyer, other problems', note: "Who the same buyer's other long-form ads are written for: formats to borrow, not competition." },
];
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

function Row({ avatar, ads, max, buyer, onOpen }: { avatar: StoredAvatar; ads: ReadAd[]; max: number; buyer: string | null; onOpen: () => void }) {
  const byAdvertiser = [...ads.reduce((m, ad) => m.set(ad.advertiser, (m.get(ad.advertiser) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const blocks = byAdvertiser.length > 0 ? byAdvertiser.map(([advertiser, n]) => ({ id: advertiser, label: advertiser, count: n, onClick: onOpen })) : [{ id: avatar.id, label: avatar.name, count: avatar.ad_count, onClick: onOpen }];
  return (
    <li className={`avatar-row standing-${avatar.standing}`}>
      <button className="avatar-name" onClick={onOpen}>
        <strong>{avatar.name}</strong>
        <span className="small dim">{avatar.ad_count} {avatar.ad_count === 1 ? 'ad' : 'ads'}{avatar.standing === 'emerging' ? ' · emerging' : ''}</span>
      </button>
      <div className="avatar-cell">
        <StackedBar blocks={blocks} width={avatar.ad_count / max} chips={byAdvertiser.length > 1} maxChips={5} />
        {avatar.profile.same_buyer && (
          <p className="same-buyer small"><span className="dim">Your buyer{buyer ? `, ${buyer}` : ''}:</span> {avatar.profile.same_buyer.shared}</p>
        )}
      </div>
      <div className="avatar-stats small">
        <span><strong>{pct(avatar.supply_share)}</strong> of ads</span>
        <span>{byAdvertiser.length} {byAdvertiser.length === 1 ? 'advertiser' : 'advertisers'} · win {pct(avatar.win_rate)}</span>
      </div>
    </li>
  );
}

export default function AdAvatars({ avatars, ads, buyers }: { avatars: StoredAvatar[]; ads: ReadAd[]; buyers: StoredAvatar[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const adsOf = (avatar: StoredAvatar) => ads.filter((ad) => ad.segment === avatar.name);
  const max = Math.max(1, ...avatars.map((a) => a.ad_count));
  const opened = avatars.find((a) => a.id === open);
  const buyerOf = (avatar: StoredAvatar) => buyers.find((b) => b.key === avatar.profile.same_buyer?.review_avatar)?.name ?? null;
  if (opened) {
    const market = MARKETS.find((m) => m.key === opened.profile.market)?.title ?? '';
    return <AdAvatarDetail avatar={opened} ads={adsOf(opened)} market={market} buyer={buyerOf(opened)} onBack={() => setOpen(null)} />;
  }
  return (
    <>
      <p className="panel small dim">
        One avatar per audience segment stage 3 sorted the lung-market and same-buyer ads into, written from what those ads say. Bar length is ads; each block is an advertiser writing to that audience. A segment with fewer than 5 ads is marked emerging. Click a row to open it.
      </p>
      {MARKETS.map((market) => {
        const own = avatars.filter((a) => a.profile.market === market.key).sort((a, b) => b.ad_count - a.ad_count);
        if (own.length === 0) return null;
        return (
          <section className="panel" key={market.key}>
            <h2>{market.title}</h2>
            <p className="small dim">{market.note}</p>
            <ol className="avatar-bars">
              {own.map((avatar) => <Row key={avatar.id} avatar={avatar} ads={adsOf(avatar)} max={max} buyer={buyerOf(avatar)} onOpen={() => setOpen(avatar.id)} />)}
            </ol>
          </section>
        );
      })}
    </>
  );
}
