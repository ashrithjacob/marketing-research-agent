import { useState } from 'react';

import { adsShape, type AdFilter, type Competitor, type ReadAd } from '../../api';
import type { BarOf } from '../StageBar';
import AdGrid from './AdGrid';
import AdsAnalysis from './AdsAnalysis';

export default function Ads({ ads, competitors, bar }: { ads: ReadAd[]; competitors: Competitor[]; bar: BarOf }) {
  const [filter, setFilterState] = useState<AdFilter>(() => adsShape.readFilter());
  const [tab, setTab] = useState<'analysis' | 'all'>(() => (Object.keys(adsShape.readFilter()).length > 0 ? 'all' : 'analysis'));
  const setFilter = (next: AdFilter) => {
    setFilterState(next);
    adsShape.writeFilter(next);
  };
  if (ads.length === 0) return bar([]);
  const chips = adsShape.rings.map((ring) => ({ label: adsShape.words(ring), value: ads.filter((ad) => adsShape.ringOf(ad) === ring).length, target: 'ads-tabs' }));
  return (
    <>
      {bar(chips)}
      <div className="tabs" id="ads-tabs" role="tablist" aria-label="Long-form ads">
        <button role="tab" id="tab-analysis" aria-selected={tab === 'analysis'} aria-controls="panel-analysis" className={tab === 'analysis' ? 'on' : ''} onClick={() => setTab('analysis')}>
          Analysis
        </button>
        <button role="tab" id="tab-all" aria-selected={tab === 'all'} aria-controls="panel-all" className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>
          All ads ({ads.length})
        </button>
      </div>
      <div role="tabpanel" id={tab === 'analysis' ? 'panel-analysis' : 'panel-all'} aria-labelledby={tab === 'analysis' ? 'tab-analysis' : 'tab-all'}>
        {tab === 'analysis' ? <AdsAnalysis ads={ads} /> : <AdGrid ads={ads} competitors={competitors} filter={filter} setFilter={setFilter} />}
      </div>
    </>
  );
}
