import { useEffect, useState } from 'react';

import { runs, type ChannelAwareness, type EvidenceItem, type MarketAssessment } from '../api';

const STAGES: Record<number, { name: string; note: string }> = {
  1: { name: 'Plain claim', note: 'few competitors, plain benefit claims' },
  2: { name: 'Bigger claim', note: 'the same claim enlarged with numbers, speed, strength' },
  3: { name: 'Mechanism', note: 'ads explain a reason why it works' },
  4: { name: 'Mechanism war', note: 'rival named mechanisms, each made bigger' },
  5: { name: 'Identity', note: 'buyers tired of claims; story and identity win' },
};

const LEVELS = ['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'];

const CHANNELS: Record<string, string> = {
  meta_ads: 'Competitor ad openings',
  landing_pages: 'Ad landing pages',
  google_search: 'Google searches',
  amazon_search: 'Amazon searches',
  amazon_listings: 'Amazon listings',
  reddit: 'Reddit',
  reviews: 'Reviews',
};

const KINDS: Record<string, string> = {
  stage_ad: 'Ad',
  history_ad: 'Past ad',
  snapshot: 'Page snapshot',
  google_query: 'Google search',
  amazon_query: 'Amazon search',
  amazon_listing: 'Amazon listing',
  reddit: 'Reddit',
  review: 'Review',
  landing_page: 'Landing page',
};

function ChannelBar({ channel }: { channel: ChannelAwareness }) {
  return (
    <div className="channel">
      <div className="channel-name small">
        {CHANNELS[channel.channel] ?? channel.channel} <span className="dim">· {channel.items} {channel.weighted_by_volume ? 'items, weighted by volume' : 'items'}</span>
      </div>
      <div className="awareness-bar">
        {LEVELS.filter((level) => (channel.shares[level] ?? 0) > 0).map((level) => (
          <span key={level} className={`level level-${level}`} style={{ flex: channel.shares[level] }} title={`${level.replace('_', ' ')}: ${Math.round((channel.shares[level] ?? 0) * 100)}%`}>
            {(channel.shares[level] ?? 0) >= 0.12 ? `${Math.round((channel.shares[level] ?? 0) * 100)}%` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function Evidence({ item }: { item: EvidenceItem }) {
  const meta = [KINDS[item.kind] ?? item.kind, item.brand, item.date, item.volume !== null ? `${item.volume.toLocaleString()} ${item.kind === 'amazon_listing' ? 'ratings' : 'searches/mo'}` : null, item.awareness?.replace('_', ' ')].filter(Boolean).join(' · ');
  return (
    <li className="small">
      <span className="dim">{meta}</span>
      <div>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.text || item.url}</a> : item.text}</div>
    </li>
  );
}

export default function Market({ runId, version, onError }: { runId: string; version: string; onError: (message: string) => void }) {
  const [market, setMarket] = useState<MarketAssessment | null | undefined>(undefined);
  useEffect(() => {
    runs.market(runId).then((answer) => setMarket(answer.market), (e: Error) => onError(e.message));
  }, [runId, version, onError]);
  if (market === undefined) return null;
  if (market === null) return <p className="panel dim">Stage 4 has not read this market yet.</p>;
  const stage = STAGES[market.sophistication_stage];
  return (
    <>
      <section className="panel">
        <h2>Market sophistication</h2>
        <div className="soph-scale">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`soph-step ${n === market.sophistication_stage ? 'current' : ''}`} title={STAGES[n]!.note}>
              {n}. {STAGES[n]!.name}
            </span>
          ))}
        </div>
        <p>
          <strong>Stage {market.sophistication_stage}: {stage?.name}</strong> <span className="badge faint">{market.confidence} confidence</span>
        </p>
        <p>{market.why}</p>
        <table className="claims">
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
      <section className="panel">
        <h2>Awareness by channel</h2>
        <p className="dim small">How much a buyer already knows when they meet the market, channel by channel. Each bar is the share of that channel's evidence at each level.</p>
        <div className="levels-key small">
          {LEVELS.map((level) => <span key={level}><span className={`swatch level-${level}`} />{level.replace('_', ' ')}</span>)}
        </div>
        {market.awareness.map((channel) => <ChannelBar key={channel.channel} channel={channel} />)}
      </section>
      <section className="panel">
        <h2>Evidence</h2>
        <ul className="evidence">{market.evidence.map((item) => <Evidence key={item.id} item={item} />)}</ul>
      </section>
    </>
  );
}
