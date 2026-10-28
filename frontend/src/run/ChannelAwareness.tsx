import { useState } from 'react';

import type { ChannelAwareness as Channel, EvidenceItem } from '../api';

export const LEVELS = ['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'];
const SMALL = 10;

const CHANNELS: Record<string, { name: string; kind: string | null; what: (n: number) => string }> = {
  meta_ads: { name: 'Competitor ad openings', kind: null, what: (n) => `${n} competitor ads from stage 3. Each was labelled from its opening lines when the ad reader read it; the labels are on the Long-form ads page.` },
  landing_pages: { name: 'Ad landing pages', kind: 'landing_page', what: (n) => `${n} landing page${n === 1 ? '' : 's'} behind competitor ads, opened and labelled by the market reader.` },
  google_search: { name: 'Google searches', kind: 'google_query', what: (n) => `${n} Google autocomplete suggestion${n === 1 ? '' : 's'} for the category, each labelled by what the searcher already knows.` },
  amazon_search: { name: 'Amazon searches', kind: 'amazon_query', what: (n) => `${n} Amazon autocomplete suggestion${n === 1 ? '' : 's'}, labelled the same way.` },
  amazon_listings: { name: 'Amazon listings', kind: 'amazon_listing', what: (n) => `${n} top Amazon listing${n === 1 ? '' : 's'} for the category, labelled by how their titles talk to the shopper.` },
  reddit: { name: 'Reddit', kind: 'reddit', what: (n) => `${n} Reddit post${n === 1 ? '' : 's'} about the problem, labelled by what the poster already knows.` },
  reviews: { name: 'Reviews', kind: 'review', what: (n) => `${n} review${n === 1 ? '' : 's'} sampled by the market reader, labelled by what the reviewer knew before buying.` },
};

const pct = (share: number | undefined) => `${Math.round((share ?? 0) * 100)}%`;

function weighting(channel: Channel, items: EvidenceItem[]): string {
  if (!channel.weighted_by_volume) {
    if (channel.channel === 'meta_ads') return 'Each ad counts once.';
    const known = items.filter((item) => item.volume !== null && item.volume > 0).length;
    return known === 0 ? 'Each item counts once: none had a volume to weigh it by.' : `Each item counts once: ${known} of ${items.length} had a volume, and a bar is weighted only when all do.`;
  }
  const total = items.reduce((n, item) => n + (item.volume ?? 0), 0);
  return channel.channel === 'amazon_listings' ? `Weighted by ratings: ${total.toLocaleString()} ratings in all, so a bigger listing counts for more.` : `Weighted by ${total.toLocaleString()} monthly searches.`;
}

function Row({ channel, evidence }: { channel: Channel; evidence: EvidenceItem[] }) {
  const [open, setOpen] = useState(false);
  const meta = CHANNELS[channel.channel];
  const items = meta?.kind ? evidence.filter((item) => item.kind === meta.kind && item.awareness) : [];
  return (
    <div className="channel">
      <div className="channel-name small">
        {meta?.name ?? channel.channel} <span className="dim">· {channel.items} item{channel.items === 1 ? '' : 's'}</span>
        {channel.items < SMALL && <span className="badge faint">small sample</span>}
      </div>
      <div className="awareness-bar">
        {LEVELS.filter((level) => (channel.shares[level] ?? 0) > 0).map((level) => (
          <span key={level} className={`level level-${level}`} style={{ flex: channel.shares[level] }} title={`${level.replace('_', ' ')}: ${pct(channel.shares[level])}`}>
            {(channel.shares[level] ?? 0) >= 0.12 ? pct(channel.shares[level]) : ''}
          </span>
        ))}
      </div>
      <p className="channel-what small dim">
        {meta?.what(channel.items)} {weighting(channel, items)}
        {items.length > 0 && <button className="link small" onClick={() => setOpen(!open)}>{open ? 'Hide items' : 'Show items'}</button>}
      </p>
      {open && (
        <ul className="channel-items small">
          {items.map((item) => (
            <li key={item.id}>
              <span className={`swatch level-${item.awareness}`} />
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.text.slice(0, 140) || item.url}</a> : item.text.slice(0, 140)}
              {item.volume !== null && <span className="dim"> · {item.volume.toLocaleString()} {item.kind === 'amazon_listing' ? 'ratings' : 'searches/mo'}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ChannelAwareness({ channels, evidence }: { channels: Channel[]; evidence: EvidenceItem[] }) {
  const total = channels.reduce((n, channel) => n + channel.items, 0);
  const ads = channels.find((channel) => channel.channel === 'meta_ads')?.items ?? 0;
  return (
    <>
      <p className="dim small">
        How much a buyer already knows when they meet the market, channel by channel. Built from {total} labelled items across {channels.length} channels: {ads} competitor ads labelled in stage 3, and {total - ads} searches, listings, pages and reviews the market reader in stage 4 gathered and labelled itself. Each bar is the share of that channel's items at each level. A channel with fewer than {SMALL} items is a hint, not a measurement.
      </p>
      <div className="levels-key small">
        {LEVELS.map((level) => <span key={level}><span className={`swatch level-${level}`} />{level.replace('_', ' ')}</span>)}
      </div>
      {channels.map((channel) => <Row key={channel.channel} channel={channel} evidence={evidence} />)}
    </>
  );
}
