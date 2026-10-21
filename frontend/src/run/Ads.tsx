import type { Competitor, ReadAd } from '../api';
import AdCard from './AdCard';
import type { BarOf } from './StageBar';

const BUCKET_ORDER: Record<string, number> = { winning: 0, testing: 1, dead: 2 };

const RINGS: { key: string; title: string; note: string; matches: (ad: ReadAd) => boolean }[] = [
  { key: 'direct_competitor', title: 'Direct competitors', note: 'the same product: what is already being said to your buyer', matches: (ad) => ad.competitor_id !== null || ad.ring === 'direct_competitor' },
  { key: 'same_problem', title: 'Same problem, other products', note: 'the same buyer at the same moment of pain; counted as supply in the avatars', matches: (ad) => ad.competitor_id === null && ad.ring === 'same_problem' },
  { key: 'same_buyer', title: 'Same buyer, other problems', note: 'hooks, story structures, proof and offers this buyer responds to; not counted as supply', matches: (ad) => ad.competitor_id === null && ad.ring === 'same_buyer' },
  { key: 'trending_shop', title: 'Trending shops, any market', note: 'long-form statics scaling for shops that are trending now; structures to apply to your store, not counted as supply', matches: (ad) => ad.competitor_id === null && ad.ring === 'trending_shop' },
  { key: 'earlier', title: 'From an earlier search', note: 'kept before the scout placed ads in rings', matches: (ad) => ad.competitor_id === null && ad.ring === null },
];

function ordered(ads: ReadAd[]): ReadAd[] {
  return [...ads].sort((a, b) => (BUCKET_ORDER[a.bucket ?? ''] ?? 3) - (BUCKET_ORDER[b.bucket ?? ''] ?? 3) || (b.days_running ?? 0) - (a.days_running ?? 0));
}

export default function Ads({ ads, competitors, bar }: { ads: ReadAd[]; competitors: Competitor[]; bar: BarOf }) {
  if (ads.length === 0) return bar([]);
  const logo = (ad: ReadAd) => {
    const owner = competitors.find((c) => c.id === ad.competitor_id);
    return owner?.logo_url ?? owner?.image_url ?? null;
  };
  const chips = RINGS.map((ring) => ({ ring, members: ads.filter(ring.matches) }))
    .filter(({ members }) => members.length > 0)
    .map(({ ring, members }) => ({ label: ring.title.toLowerCase(), value: `${members.length} · ${members.filter((ad) => ad.bucket === 'winning').length} winning`, target: `ring-${ring.key}` }));
  return (
    <>
      {bar(chips)}
      <section className="panel">
        <h2>Long-form statics in this market</h2>
        <p className="dim small">Found and grouped by the scout agent as a growth marketer would study them; winning ads first in each group.</p>
        {RINGS.map((ring) => {
          const members = ordered(ads.filter(ring.matches));
          if (members.length === 0) return null;
          return (
            <div key={ring.key} id={`ring-${ring.key}`} className="ring">
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
      </section>
    </>
  );
}
