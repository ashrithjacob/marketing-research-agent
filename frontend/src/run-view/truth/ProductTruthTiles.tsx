import type { Gap, ProductTruthPacket } from '../../api';
import { ClaimsTile } from './ClaimsTile';
import { DoseTile } from './DoseTile';
import { EconomicsTile } from './EconomicsTile';
import { IngredientsTile } from './IngredientsTile';

/** The four tiles of one product-truth packet, each with the gaps of its own node. */
export function ProductTruthTiles({ runId, packet, only }: { runId: string; packet: ProductTruthPacket; only?: 'mechanism' | 'dose_vs_study' | 'claim_limits' | 'cogs_refills' }) {
  const gaps = (node: string): Gap[] => packet.gaps.filter((g) => g.node === node);
  const shows = (node: string) => !only || only === node;
  return (
    <>
      {shows('mechanism') && <IngredientsTile runId={runId} packet={packet} gaps={gaps('mechanism')} />}
      {shows('dose_vs_study') && <DoseTile runId={runId} packet={packet} gaps={gaps('dose_vs_study')} />}
      {shows('claim_limits') && <ClaimsTile runId={runId} packet={packet} gaps={gaps('claim_limits')} />}
      {shows('cogs_refills') && <EconomicsTile runId={runId} packet={packet} gaps={gaps('cogs_refills')} />}
    </>
  );
}
