import type { Gap, ProductTruthPacket } from '../../api';
import { Chip, Tile, TileGaps } from '../tile';
import { Cite } from '../cite';
import { Fold, FoldCard, Lines } from '../fold';

const PLATFORM: Record<string, string> = { meta: 'Meta', google_ads: 'Google Ads' };

/** What the product may and may not claim, per market and ad platform, written out, with the disclaimers and the guard. */
export function ClaimsTile({ runId, packet, gaps }: { runId: string; packet: ProductTruthPacket; gaps: Gap[] }) {
  return (
    <Tile
      label="Claim limits"
      sub="per market and ad platform, from the regulators' and platforms' own pages"
      chips={<Chip>{packet.claim_limits.length} market × platform</Chip>}
      defaultOpen
    >
      <p className="warn small">{packet.guard}</p>
      <div className="pt-cards">
        {packet.claim_limits.map((c) => (
          <FoldCard
            key={`${c.market}-${c.platform}`}
            title={`${c.market} · ${PLATFORM[c.platform] ?? c.platform}`}
            glance={`${c.permitted.length} permitted · ${c.forbidden.length} forbidden · ${c.source_ids.length} sources`}
          >
            <Fold label="permitted" preview={c.permitted.join(' · ') || 'none recorded'} tone="ok">
              <Lines lines={c.permitted} />
            </Fold>
            <Fold label="forbidden" preview={c.forbidden.join(' · ') || 'none recorded'} tone="bad">
              <Lines lines={c.forbidden} />
            </Fold>
            <Fold label="disclaimers" preview={c.disclaimers.join(' · ') || 'none recorded'}>
              <Lines lines={c.disclaimers} />
            </Fold>
            <Fold label="evidence standard" preview={c.evidence_standard} />
            <Fold label="sources" preview={`${c.source_ids.length} pages`}>
              {c.source_ids.map((id) => <Cite key={id} runId={runId} id={id} sources={packet.sources} />)}
            </Fold>
          </FoldCard>
        ))}
      </div>
      <TileGaps gaps={gaps} />
    </Tile>
  );
}
