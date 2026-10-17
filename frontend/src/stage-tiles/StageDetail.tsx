import type { ProductTruthPacket, ResearchNode, RunDetail, StagePacket, StageNumber } from '../api';
import { AvatarCards } from '../run-view/customer/AvatarCards';
import { AwarenessGrid } from '../run-view/customer/AwarenessGrid';
import { IdentityLayer } from '../run-view/customer/IdentityLayer';
import { LanguageBank } from '../run-view/customer/LanguageBank';
import { MarketSection } from '../run-view/market/MarketSection';
import { VerdictPanel } from '../run-view/market/VerdictPanel';
import { StageOneTiles } from '../run-view/stage-one-tiles';
import { GapsInOwnTab, TilesOpen } from '../run-view/tile';
import { ProductTruthTiles } from '../run-view/truth/ProductTruthTiles';
import { VoiceAnalysis } from '../run-view/voice/VoiceAnalysis';
import StageGaps from './StageGaps';
import StageSources from './StageSources';

type StageOneSection = 'product_data' | 'competitors' | 'category_data';
type TruthSection = 'mechanism' | 'dose_vs_study' | 'claim_limits' | 'cogs_refills';

type DetailProps = { stage: StageNumber; tab: string; run: RunDetail; requiredFields: Record<string, string[]> };

export default function StageDetail(props: DetailProps) {
  return (
    <GapsInOwnTab.Provider value>
      <Section {...props} />
    </GapsInOwnTab.Provider>
  );
}

function Section({ stage, tab, run, requiredFields }: DetailProps) {
  const packet = run.packet;
  if (tab === 'sources') return <StageSources sources={packet?.sources ?? []} />;
  if (tab === 'gaps') return <StageGaps gaps={packet?.gaps ?? []} />;
  if (stage === 3) {
    return (
      <div className="voice-tile">
        <VoiceAnalysis runId={run.id} finished />
      </div>
    );
  }
  if (!packet) return <p className="muted small">{run.error || 'This run kept nothing to show.'}</p>;
  if (stage === 5) {
    const customer = packet as StagePacket;
    if (tab === 'language_bank') return <LanguageBank runId={run.id} packet={customer} />;
    if (tab === 'identity') return <IdentityLayer runId={run.id} packet={customer} />;
    if (tab === 'awareness') return <AwarenessGrid packet={customer} />;
    return <AvatarCards runId={run.id} packet={customer} />;
  }
  if (stage === 4) {
    const market = packet as StagePacket;
    if (tab === 'viability') return <VerdictPanel runId={run.id} productId={run.product_id} packet={market} />;
    return (
      <TilesOpen.Provider value>
        <div className="tiles">
          <MarketSection runId={run.id} packet={market} node={tab as ResearchNode} required={requiredFields[tab] ?? []} />
        </div>
      </TilesOpen.Provider>
    );
  }
  return (
    <TilesOpen.Provider value>
      <div className="tiles">
        {stage === 1 && packet.stage !== 2 && <StageOneTiles runId={run.id} packet={packet as StagePacket} nodes={new Set(run.nodes ?? [])} listings={run.listings ?? []} requiredFields={requiredFields} only={tab as StageOneSection} />}
        {stage === 2 && packet.stage === 2 && <ProductTruthTiles runId={run.id} packet={packet as ProductTruthPacket} only={tab as TruthSection} />}
      </div>
    </TilesOpen.Provider>
  );
}
