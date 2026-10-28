import { useState } from 'react';

import type { AvatarQuote, StoredAvatar } from '../api';
import AvatarMap, { gapOf } from './AvatarMap';
import { GapBars, GapSummary, ThemeMatrix } from './GapCharts';
import GapDetail from './GapDetail';

const pct = (v: number | null) => `${Math.round((v ?? 0) * 100)}%`;

export default function AvatarGaps({ avatars, quotes }: { avatars: StoredAvatar[]; quotes: AvatarQuote[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const tops = avatars.filter((a) => a.parent_id === null).sort((a, b) => gapOf(b) - gapOf(a));
  const opened = tops.find((a) => a.id === open);
  if (opened) return <GapDetail avatar={opened} quotes={quotes.filter((q) => q.avatar_id === opened.id)} onBack={() => setOpen(null)} />;
  return (
    <>
      <section className="panel">
        <h2>Where buyers are and the ads are not</h2>
        <p className="small dim">Each avatar from reviews: its share of the reviews against its share of the lung-market and same-buyer ads placed on it. An avatar with more of the buyers than of the ads is a market the competitors leave open.</p>
        <GapSummary tops={tops} />
      </section>
      <section className="panel">
        <h2>Buyers against ads</h2>
        <p className="small dim">Up: share of reviews. Right: share of ads. Size: reviews. On the diagonal, ads match buyers; above it (blue) is under-served, below it (amber) crowded. Click a bubble or a name.</p>
        <div className="gap-figure">
          <AvatarMap tops={tops} onOpen={setOpen} />
          <ol className="map-key">
            {tops.map((avatar, i) => (
              <li key={avatar.id}>
                <button className="link-button" onClick={() => setOpen(avatar.id)}><span className={`key-number ${gapOf(avatar) >= 0 ? 'under' : 'over'}`}>{i + 1}</span>{avatar.name}</button>
                <span className="small dim">{pct(avatar.demand_share)} of reviews · {pct(avatar.supply_share)} of ads</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="panel">
        <h2>Gap by avatar</h2>
        <p className="small dim">Share of reviews minus share of ads, most under-served first.</p>
        <GapBars tops={tops} onOpen={setOpen} />
      </section>
      <section className="panel">
        <h2>What the ads leave out</h2>
        <p className="small dim">Themes an avatar's reviews raise that none of its ads say, counted by kind. Darker is more. Click an avatar to read them with the reviews that say them.</p>
        <ThemeMatrix tops={tops} onOpen={setOpen} />
      </section>
    </>
  );
}
