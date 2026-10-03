import type { Gap, ProductTruthPacket } from '../../api';
import { Chip, Tile, TileGaps } from '../tile';
import { Cite } from '../cite';

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
      {packet.claim_limits.map((c) => (
        <div key={`${c.market}-${c.platform}`} className="pt-claims">
          <h3>
            {c.market} · {PLATFORM[c.platform] ?? c.platform}
          </h3>
          <div className="small">Sources: {c.source_ids.map((id) => <Cite key={id} runId={runId} id={id} sources={packet.sources} />)}</div>
          {c.disclaimers.length > 0 && <div className="small muted">Disclaimers: {c.disclaimers.join(' · ')}</div>}
          <div className="small muted">Evidence standard: {c.evidence_standard}</div>
          <div className="pt-columns">
            <div>
              <div className="pt-col-head ok">Permitted</div>
              <ul>{c.permitted.map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
            <div>
              <div className="pt-col-head bad">Forbidden</div>
              <ul>{c.forbidden.map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
          </div>
        </div>
      ))}
      <TileGaps gaps={gaps} />
    </Tile>
  );
}
