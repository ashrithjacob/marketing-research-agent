import { useState } from 'react';

import { marketShape, type EvidenceItem } from '../api';

const KINDS: Record<string, string> = { stage_ad: 'Ad', history_ad: 'Past ad', snapshot: 'Page snapshot', amazon_listing: 'Amazon listing', google_query: 'Google search', amazon_query: 'Amazon search', reddit: 'Reddit', review: 'Review', landing_page: 'Landing page' };

function Source({ item }: { item: EvidenceItem }) {
  const meta = [KINDS[item.kind] ?? item.kind, item.brand, item.date, item.volume !== null ? `${item.volume.toLocaleString()} ${item.kind === 'amazon_listing' ? 'ratings' : 'searches/mo'}` : null].filter(Boolean).join(' · ');
  const text = item.text.length > 160 ? `${item.text.slice(0, 160)}…` : item.text;
  return (
    <li className="small">
      <span className="dim">{meta}</span>
      <div>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{text || item.url}</a> : text}</div>
    </li>
  );
}

export default function MarketWhy({ why, evidence }: { why: string; evidence: EvidenceItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const parts = marketShape.why(why, evidence);
  const picked = open !== null ? parts[open] : undefined;
  return (
    <>
      <ol className="market-why">
        {marketShape.lines(parts).map((line, n) => (
          <li key={n}>
            {line.map((part, k) => {
              const i = parts.indexOf(part);
              if ('text' in part) return marketShape.spans(part.text).map((span, j) => (span.kind === 'plain' ? <span key={`${n}-${k}-${j}`}>{span.text}</span> : <mark key={`${n}-${k}-${j}`} className={`why-${span.kind}`}>{span.text}</mark>));
              return (
                <button key={i} className={`cite ${open === i ? 'on' : ''}`} onClick={() => setOpen(open === i ? null : i)} title="Show the sources">
                  {part.label}
                </button>
              );
            })}
          </li>
        ))}
      </ol>
      {picked && 'cited' in picked && (
        <div className="cite-box">
          <ul className="evidence">{picked.cited.map((item) => <Source key={item.id} item={item} />)}</ul>
          {picked.missing.length > 0 && <p className="small dim">{picked.missing.length} more cited, but this run did not keep them. Runs from now on keep every source the reasoning cites.</p>}
        </div>
      )}
    </>
  );
}
