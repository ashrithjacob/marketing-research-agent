import { useState } from 'react';

import { adsShape, type AdFilter, type AdsAnalysis, type Competitor, type ReadAd } from '../../api';
import AdCard from '../AdCard';

const FILTERS = ['proven', 'bucket', 'ring', 'brand', 'angle', ...adsShape.labels];
const SORTS: Record<string, (a: ReadAd, b: ReadAd) => number> = {
  'days running': (a, b) => (b.days_running ?? 0) - (a.days_running ?? 0),
  duplicates: (a, b) => (b.duplicates ?? 0) - (a.duplicates ?? 0),
  'first seen': (a, b) => (b.first_seen ?? '').localeCompare(a.first_seen ?? ''),
};

export default function AdGrid({ ads, competitors, analysis, filter, setFilter }: { ads: ReadAd[]; competitors: Competitor[]; analysis: AdsAnalysis | null; filter: AdFilter; setFilter: (filter: AdFilter) => void }) {
  const [sort, setSort] = useState('days running');
  const shown = ads.filter((ad) => adsShape.matches(ad, filter, analysis)).sort(SORTS[sort]);
  const logo = (ad: ReadAd) => {
    const owner = competitors.find((c) => c.id === ad.competitor_id);
    return owner?.logo_url ?? owner?.image_url ?? null;
  };
  const angleName = (key: string) => analysis?.angles.find((angle) => angle.key === key)?.name ?? key;
  const change = (key: string, value: string) => {
    const { [key]: _old, ...rest } = filter;
    setFilter(value ? { ...rest, [key]: value } : rest);
  };
  return (
    <section id="ads-all" className="panel">
      <h2>All ads <span className="dim small">({shown.length} of {ads.length})</span></h2>
      <div className="filters">
        {FILTERS.map((key) => {
          const values = adsShape.values(ads, key, analysis);
          if (values.length === 0) return null;
          return (
            <label key={key} className="chip">
              {adsShape.words(key)}
              <select value={filter[key] ?? ''} onChange={(e) => change(key, e.target.value)}>
                <option value="">any</option>
                {values.map((value) => (
                  <option key={value} value={value}>
                    {key === 'angle' ? angleName(value) : adsShape.words(value)} ({ads.filter((ad) => adsShape.matches(ad, { ...filter, [key]: value }, analysis)).length})
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        {filter.ids && <span className="chip on">{filter.ids.split(',').length} ads from a finding</span>}
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
          <AdCard key={ad.id} ad={ad} logo={logo(ad)} proven={analysis?.proven_ids.includes(ad.id) ?? false} angle={analysis?.angle_of[ad.id] ? angleName(analysis.angle_of[ad.id]) : null} />
        ))}
      </ul>
    </section>
  );
}
