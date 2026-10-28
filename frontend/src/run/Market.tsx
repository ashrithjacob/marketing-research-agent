import { useEffect, useState } from 'react';

import { marketShape, type MarketAssessment, type ReadAd } from '../api';
import ChannelAwareness from './ChannelAwareness';
import MarketEvidence from './MarketEvidence';
import MarketWhy from './MarketWhy';
import SophisticationLadder, { STAGES } from './SophisticationLadder';
import type { BarOf } from './StageBar';

export default function Market({ runId, version, bar, onError }: { runId: string; version: string; bar: BarOf; onError: (message: string) => void }) {
  const [view, setView] = useState<{ market: MarketAssessment | null; ads: ReadAd[] } | undefined>(undefined);
  useEffect(() => {
    marketShape.load(runId).then(setView, (e: Error) => onError(e.message));
  }, [runId, version, onError]);
  if (view === undefined) return bar([]);
  const { market, ads } = view;
  if (market === null) return <>{bar([])}<p className="panel dim">Stage 4 has not read this market yet.</p></>;
  const stage = STAGES[market.sophistication_stage];
  const groups = marketShape.groups(market.evidence, ads);
  return (
    <>
      {bar([
        { label: 'sophistication', value: `${market.sophistication_stage} · ${stage?.name ?? ''}`, target: 'market-sophistication' },
        { label: 'claims tracked', value: market.claims.length, target: 'market-claims' },
        { label: 'channels read for awareness', value: market.awareness.length, target: 'market-awareness' },
        { label: 'evidence items', value: market.evidence.length, target: 'market-evidence' },
      ])}
      <section id="market-sophistication" className="panel">
        <h2>Market sophistication</h2>
        <SophisticationLadder current={market.sophistication_stage} steps={marketShape.steps(market.claims)} />
        <p>
          <strong>Stage {market.sophistication_stage}: {stage?.name}</strong> <span className="badge faint">{market.confidence} confidence</span>
        </p>
        <MarketWhy why={market.why} evidence={market.evidence} />
        <table id="market-claims" className="claims">
          <thead>
            <tr><th>Claim</th><th>Type</th><th>Brands</th><th>Ads</th><th>First seen</th><th>Longest run</th><th>Running</th></tr>
          </thead>
          <tbody>
            {market.claims.map((claim) => (
              <tr key={claim.key}>
                <td>{claim.claim}</td><td>{claim.claim_type}</td><td>{claim.brands.join(', ')}</td><td>{claim.ads}</td><td>{claim.first_seen ?? '—'}</td><td>{claim.longest_days !== null ? `${claim.longest_days} days` : '—'}</td><td>{claim.active}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section id="market-awareness" className="panel">
        <h2>Awareness by channel</h2>
        <ChannelAwareness channels={market.awareness} evidence={market.evidence} />
      </section>
      <section id="market-evidence" className="panel">
        <h2>Evidence</h2>
        <MarketEvidence groups={groups} items={market.evidence.length} />
      </section>
    </>
  );
}
