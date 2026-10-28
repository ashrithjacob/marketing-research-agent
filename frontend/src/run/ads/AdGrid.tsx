import { useState } from 'react';

import { adsShape, type AdFilter, type Competitor, type ReadAd } from '../../api';
import AdCard from '../AdCard';

const FILTERS = ['page', 'bucket', 'brand', ...adsShape.labels];
const SORTS: Record<string, (a: ReadAd, b: ReadAd) => number> = {
  'days running': (a, b) => (b.days_running ?? 0) - (a.days_running ?? 0),
  duplicates: (a, b) => (b.duplicates ?? 0) - (a.duplicates ?? 0),
  'first seen': (a, b) => (b.first_seen ?? '').localeCompare(a.first_seen ?? ''),
};

export default function AdGrid({ ads, competitors, filter, setFilter }: { ads: ReadAd[]; competitors: Competitor[]; filter: AdFilter; setFilter: (filter: AdFilter) => void }) {
  const [sort, setSort] = useState('days running');
  const shown = ads.filter((ad) => adsShape.matches(ad, filter)).sort(SORTS[sort]);
  const logo = (ad: ReadAd) => {
    const owner = competitors.find((c) => c.id === ad.competitor_id);
    return owner?.logo_url ?? owner?.image_url ?? null;
  };
  const change = (key: string, value: string) => {
    const { [key]: _old, ...rest } = filter;
    setFilter(value ? { ...rest, [key]: value } : rest);
  };
  return (
    <section id="ads-all" className="panel">
      <h2>Pulled ads <span className="dim small">({shown.length} of {ads.length})</span></h2>
      <div className="filters">
        {[null, ...adsShape.rings].map((ring) => (
          <button key={ring ?? 'all'} className={`chip${(filter.ring ?? null) === ring ? ' on' : ''}`} onClick={() => change('ring', ring ?? '')}>
            {ring ? adsShape.words(ring) : 'all categories'} ({ring ? ads.filter((ad) => adsShape.ringOf(ad) === ring).length : ads.length})
          </button>
        ))}
      </div>
      <div className="filters">
        {FILTERS.map((key) => {
          const values = adsShape.values(ads, key);
          if (values.length === 0) return null;
          return (
            <label key={key} className="chip">
              {adsShape.words(key)}
              <select value={filter[key] ?? ''} onChange={(e) => change(key, e.target.value)}>
                <option value="">any</option>
                {values.map((value) => (
                  <option key={value} value={value}>
                    {adsShape.words(value)} ({ads.filter((ad) => adsShape.matches(ad, { ...filter, [key]: value })).length})
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        {Object.keys(filter).length > 0 && <button className="ghost small" onClick={() => setFilter({})}>Clear filters</button>}
        <label className="chip">
          sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.keys(SORTS).map((key) => <option key={key}>{key}</option>)}
          </select>
        </label>
      </div>
      <ul className="cards ads">
        {shown.map((ad) => (
          <AdCard key={ad.id} ad={ad} logo={logo(ad)} />
        ))}
      </ul>
    </section>
  );
}
