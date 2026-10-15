import type { ProductTruthPacket, RunDetail, StagePacket, StageNumber } from '../api';
import { StageOneTiles } from '../run-view/stage-one-tiles';
import { TilesOpen } from '../run-view/tile';
import { ProductTruthTiles } from '../run-view/truth/ProductTruthTiles';
import { VoiceAnalysis } from '../run-view/voice/VoiceAnalysis';
import StageGaps from './StageGaps';
import StageSources from './StageSources';

type StageOneSection = 'product_data' | 'competitors' | 'category_data';
type TruthSection = 'mechanism' | 'dose_vs_study' | 'claim_limits' | 'cogs_refills';

export default function StageDetail({ stage, tab, run, requiredFields }: { stage: StageNumber; tab: string; run: RunDetail; requiredFields: Record<string, string[]> }) {
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
  return (
    <TilesOpen.Provider value>
      <div className="tiles">
        {stage === 1 && packet.stage !== 2 && <StageOneTiles runId={run.id} packet={packet as StagePacket} nodes={new Set(run.nodes ?? [])} listings={run.listings ?? []} requiredFields={requiredFields} only={tab as StageOneSection} />}
        {stage === 2 && packet.stage === 2 && <ProductTruthTiles runId={run.id} packet={packet as ProductTruthPacket} only={tab as TruthSection} />}
      </div>
    </TilesOpen.Provider>
  );
}
