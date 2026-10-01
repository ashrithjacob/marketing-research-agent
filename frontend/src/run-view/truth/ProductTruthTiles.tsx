import type { Gap, ProductTruthPacket } from '../../api';
import { ClaimsTile } from './ClaimsTile';
import { DoseTile } from './DoseTile';
import { EconomicsTile } from './EconomicsTile';
import { IngredientsTile } from './IngredientsTile';

/** The four tiles of one product-truth packet, each with the gaps of its own node. */
export function ProductTruthTiles({ runId, packet }: { runId: string; packet: ProductTruthPacket }) {
  const gaps = (node: string): Gap[] => packet.gaps.filter((g) => g.node === node);
  return (
    <>
      <IngredientsTile runId={runId} packet={packet} gaps={gaps('mechanism')} />
      <DoseTile runId={runId} packet={packet} gaps={gaps('dose_vs_study')} />
      <ClaimsTile runId={runId} packet={packet} gaps={gaps('claim_limits')} />
      <EconomicsTile runId={runId} packet={packet} gaps={gaps('cogs_refills')} />
    </>
  );
}
