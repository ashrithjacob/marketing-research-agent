import { useState } from 'react';

import type { Competitor, ReadAd } from '../api';
import AdCard from './AdCard';

const BUCKET_ORDER: Record<string, number> = { winning: 0, testing: 1, dead: 2 };

const RINGS: { key: string; title: string; note: string; matches: (ad: ReadAd) => boolean }[] = [
  { key: 'competitor', title: "Competitors' own ads", note: 'the confirmed competitors, by their domains', matches: (ad) => ad.competitor_id !== null },
  { key: 'same_problem', title: 'Same problem, other products', note: 'the same buyer at the same moment of pain; counted as supply in the avatars', matches: (ad) => ad.competitor_id === null && ad.reading?.relation === 'same_problem' },
  { key: 'same_buyer', title: 'Same buyer, other problems', note: 'hooks, story structure, proof and offers this buyer responds to; not counted as supply', matches: (ad) => ad.competitor_id === null && ad.reading?.relation === 'same_buyer' },
  { key: 'unread', title: 'Not read yet', note: 'the reader has not placed these yet', matches: (ad) => ad.competitor_id === null && !ad.reading },
];

function ordered(ads: ReadAd[]): ReadAd[] {
  return [...ads].sort((a, b) => (BUCKET_ORDER[a.bucket ?? ''] ?? 3) - (BUCKET_ORDER[b.bucket ?? ''] ?? 3) || (b.days_running ?? 0) - (a.days_running ?? 0));
}

export default function Ads({ ads, competitors }: { ads: ReadAd[]; competitors: Competitor[] }) {
  const [showUnrelated, setShowUnrelated] = useState(false);
  if (ads.length === 0) return null;
  const logo = (ad: ReadAd) => {
    const owner = competitors.find((c) => c.id === ad.competitor_id);
    return owner?.logo_url ?? owner?.image_url ?? null;
  };
  const unrelated = ads.filter((ad) => ad.competitor_id === null && ad.reading?.relation === 'unrelated');
  return (
    <section className="panel">
      <h2>Long-form statics in this market</h2>
      <p className="dim small">Grouped as a growth marketer would study them; winning ads first in each group.</p>
      {RINGS.map((ring) => {
        const members = ordered(ads.filter(ring.matches));
        if (members.length === 0) return null;
        return (
          <div key={ring.key} className="ring">
            <h3>
              {ring.title} <span className="dim small">({members.length}, {members.filter((ad) => ad.bucket === 'winning').length} winning) · {ring.note}</span>
            </h3>
            <ul className="cards ads">
              {members.map((ad) => (
                <AdCard key={ad.id} ad={ad} logo={logo(ad)} />
              ))}
            </ul>
          </div>
        );
      })}
      {unrelated.length > 0 && (
        <button className="ghost small" onClick={() => setShowUnrelated(!showUnrelated)}>
          {showUnrelated ? 'Hide' : 'Show'} {unrelated.length} unrelated ads the search also matched
        </button>
      )}
      {showUnrelated && (
        <ul className="cards ads">
          {ordered(unrelated).map((ad) => (
            <AdCard key={ad.id} ad={ad} logo={null} />
          ))}
        </ul>
      )}
    </section>
  );
}
