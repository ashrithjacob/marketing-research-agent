import type { ResearchNode, StagePacket } from '../../api';
import { NODE_LABELS } from '../../stages';
import { FieldList } from '../field-list';
import { Tile, TileGaps } from '../tile';
import { BuyerStageShares } from './BuyerStageShares';
import { ElementShares } from './ElementShares';

const ABOUT: Partial<Record<ResearchNode, string>> = {
  tam_sam: 'the whole market, built upward, and the part this product can reach',
  offers: 'what competitors sell, structurally: prices, discounts, guarantees, funnels',
  sophistication: 'which of the five stages the market is at, from the claims already running',
  breaking_point: 'the moments that make someone start looking',
};

/** One market-truth section: its facts and figures, each with the page it rests on, then what could not be found. */
export function MarketSection({ runId, packet, node, required }: { runId: string; packet: StagePacket; node: ResearchNode; required: string[] }) {
  const attributes = packet.attributes.filter((a) => a.node === node);
  const measurements = packet.measurements.filter((m) => m.node === node);
  const gaps = packet.gaps.filter((g) => g.node === node);
  return (
    <Tile label={NODE_LABELS[node]} sub={ABOUT[node]} defaultOpen>
      {node === 'sophistication' && <ElementShares shares={packet.element_shares ?? []} />}
      {node === 'sophistication' && <BuyerStageShares shares={packet.buyer_stage_shares ?? []} />}
      <FieldList attributes={attributes} measurements={measurements} required={required} runId={runId} sources={packet.sources} />
      <TileGaps gaps={gaps} force />
    </Tile>
  );
}
