import { Fragment, useState } from 'react';

import { type AdFilter, type AdsAnalysis, type AngleRow } from '../../api';
import BrandAngleGrid from './BrandAngleGrid';

type SortKey = 'proven' | 'ads' | 'brands' | 'median_days' | 'longest_days' | 'duplicates';

const COLUMNS: { key: SortKey; label: string; value: (row: AngleRow) => number }[] = [
  { key: 'ads', label: 'Ads', value: (r) => r.ads },
  { key: 'proven', label: 'Proven', value: (r) => r.proven },
  { key: 'brands', label: 'Brands', value: (r) => r.brands.length },
  { key: 'median_days', label: 'Median days', value: (r) => r.median_days ?? 0 },
  { key: 'longest_days', label: 'Longest', value: (r) => r.longest_days ?? 0 },
  { key: 'duplicates', label: 'Duplicates', value: (r) => r.duplicates },
];

function AngleDetail({ row, onFilter }: { row: AngleRow; onFilter: (filter: AdFilter) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (id: string, text: string) => navigator.clipboard?.writeText(text).then(() => setCopied(id), () => setCopied(null));
  return (
    <div className="angle-detail small">
      <p>{row.description}</p>
      <p className="dim">How its {row.proven > 0 ? 'proven' : 'longest-running'} ads open:</p>
      <ul className="hooks">
        {row.hooks.map((hook) => (
          <li key={hook.ad_id}>
            <q>{hook.hook}</q> <span className="dim">· {hook.advertiser}, running since {hook.days_running ?? '?'} days</span>{' '}
            <button className="ghost small" onClick={() => copy(hook.ad_id, hook.hook)}>{copied === hook.ad_id ? 'Copied' : 'Copy'}</button>
          </li>
        ))}
      </ul>
      <p className="dim">Brands: {row.brands.join(', ')}</p>
      <button className="ghost small" onClick={() => onFilter({ angle: row.key })}>See its {row.ads} ads</button>
    </div>
  );
}

export default function ProvenStep({ analysis, onFilter }: { analysis: AdsAnalysis; onFilter: (filter: AdFilter) => void }) {
  const [sort, setSort] = useState<SortKey>('proven');
  const [open, setOpen] = useState<string | null>(null);
  const [grid, setGrid] = useState(false);
  if (analysis.angles.length === 0) return <p className="dim">These ads have not been grouped into angles: rerun stage 3 to group them.</p>;
  const column = COLUMNS.find((c) => c.key === sort)!;
  const rows = [...analysis.angles].sort((a, b) => column.value(b) - column.value(a) || b.proven / Math.max(b.ads, 1) - a.proven / Math.max(a.ads, 1));
  return (
    <>
      <table className="claims scoreboard">
        <thead>
          <tr>
            <th>Angle</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="num">
                <button className={`link-button${c.key === sort ? ' on' : ''}`} onClick={() => setSort(c.key)}>{c.label}</button>
              </th>
            ))}
            <th>Earliest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.key}>
              <tr className="clickable" onClick={() => setOpen(open === row.key ? null : row.key)}>
                <td><strong>{row.name}</strong></td>
                {COLUMNS.map((c) => <td key={c.key} className="num">{c.value(row)}</td>)}
                <td>{row.earliest ?? '?'}</td>
              </tr>
              {open === row.key && (
                <tr>
                  <td colSpan={COLUMNS.length + 2}><AngleDetail row={row} onFilter={onFilter} /></td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="dim small">Proven: still running, 30 or more days, duplicated at least twice. Days are TrendTrack's span since the creative first appeared, not proof it ran every day. Click a row for its hooks.</p>
      <button className="ghost small" onClick={() => setGrid(!grid)}>{grid ? 'Hide' : 'Show'} who runs which angle</button>
      {grid && <BrandAngleGrid analysis={analysis} onFilter={onFilter} />}
    </>
  );
}
