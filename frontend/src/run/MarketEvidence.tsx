import { useState } from 'react';

import type { EvidenceGroup } from '../api';

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
const FIRST = 12;

function dates(group: EvidenceGroup): string | null {
  const seen = group.copies.map((copy) => copy.first_seen).filter((date): date is string => Boolean(date));
  if (seen.length === 0) return null;
  return seen[0] === seen.at(-1) ? seen[0]! : `${seen[0]} to ${seen.at(-1)}`;
}

function Group({ group }: { group: EvidenceGroup }) {
  const copies = group.copies.length;
  const meta = [KINDS[group.kind] ?? group.kind, copies > 1 ? `${copies} ads with this copy` : null, group.brand, dates(group), group.volume !== null ? `${group.volume.toLocaleString()} ${group.kind === 'amazon_listing' ? 'ratings' : 'searches/mo'}` : null, group.awareness?.replace('_', ' ')].filter(Boolean).join(' · ');
  const link = group.copies[0]?.url ?? group.url;
  return (
    <li className="small">
      <span className="dim">{meta}</span>
      <div>{link ? <a href={link} target="_blank" rel="noreferrer">{group.text || link}</a> : group.text}</div>
      {(copies > 0 || group.landing_url) && (
        <div className="evidence-links dim">
          {copies > 1 && <>In the Meta Ad Library: {group.copies.map((copy, i) => (copy.url ? <a key={copy.id} href={copy.url} target="_blank" rel="noreferrer">{i + 1}</a> : null))}</>}
          {copies === 1 && group.copies[0]?.url && <a href={group.copies[0].url} target="_blank" rel="noreferrer">Meta Ad Library</a>}
          {group.landing_url && <a href={group.landing_url} target="_blank" rel="noreferrer">landing page</a>}
        </div>
      )}
    </li>
  );
}

export default function MarketEvidence({ groups, items }: { groups: EvidenceGroup[]; items: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? groups : groups.slice(0, FIRST);
  return (
    <>
      <p className="small dim">
        Every source the market reader cited: {items} items, shown as {groups.length} because ads running the same copy are grouped. An ad's text opens it in the Meta Ad Library; the landing page link opens the page it sends buyers to.
      </p>
      <ul className="evidence">{shown.map((group) => <Group key={group.id} group={group} />)}</ul>
      {groups.length > FIRST && <button className="link small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `+${groups.length - FIRST} more`}</button>}
    </>
  );
}
