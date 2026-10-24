import { useState } from 'react';

import { adsShape, type AdFilter, type Competitor, type ReadAd } from '../../api';
import type { BarOf } from '../StageBar';
import AdGrid from './AdGrid';
import AnatomyStep from './AnatomyStep';
import FitStep from './FitStep';
import MomentumStep from './MomentumStep';
import ProvenStep from './ProvenStep';
import StepHead, { STEPS } from './StepHead';
import { useAdsAnalysis } from './use-ads-analysis';

const WAITS = 'Written by gap detection (stage 6), which needs the avatars from stage 5. Not built yet.';

export default function Ads({ runId, version, ads, competitors, bar, onError }: { runId: string; version: string; ads: ReadAd[]; competitors: Competitor[]; bar: BarOf; onError: (message: string) => void }) {
  const analysis = useAdsAnalysis(runId, version, onError);
  const [filter, setFilterState] = useState<AdFilter>(() => adsShape.readFilter());
  const setFilter = (next: AdFilter) => {
    setFilterState(next);
    adsShape.writeFilter(next);
  };
  const showAds = (next: AdFilter) => {
    setFilter(next);
    document.getElementById('ads-all')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  if (ads.length === 0) return bar([]);
  const chips = [
    ...STEPS.map((info) => ({ label: info.title.toLowerCase(), value: info.step, target: `ads-step-${info.step}` })),
    { label: 'all ads', value: ads.length, target: 'ads-all' },
  ];
  return (
    <>
      {bar(chips)}
      {analysis && (
        <>
          <p className="panel small">
            <strong>{analysis.read}</strong> ads read from <strong>{new Set(ads.map(adsShape.brandOf)).size}</strong> brands; <strong>{analysis.proven}</strong> proven (still running after 30 days and duplicated). No one can see a competitor's spend: proven means scaled and kept running, not known to be profitable.
          </p>
          <StepHead info={STEPS[0]!} analysis={analysis} onFilter={showAds} waiting={WAITS} />
          <StepHead info={STEPS[1]!} analysis={analysis} onFilter={showAds}>
            <ProvenStep analysis={analysis} onFilter={showAds} />
          </StepHead>
          <StepHead info={STEPS[2]!} analysis={analysis} onFilter={showAds}>
            <MomentumStep analysis={analysis} onFilter={showAds} />
          </StepHead>
          <StepHead info={STEPS[3]!} analysis={analysis} onFilter={showAds}>
            <AnatomyStep analysis={analysis} onFilter={showAds} />
          </StepHead>
          <StepHead info={STEPS[4]!} analysis={analysis} onFilter={showAds}>
            <FitStep analysis={analysis} onFilter={showAds} />
          </StepHead>
          <StepHead info={STEPS[5]!} analysis={analysis} onFilter={showAds} waiting={WAITS} />
        </>
      )}
      <AdGrid ads={ads} competitors={competitors} analysis={analysis} filter={filter} setFilter={setFilter} />
    </>
  );
}
