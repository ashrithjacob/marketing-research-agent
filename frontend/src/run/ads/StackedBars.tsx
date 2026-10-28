import { useState } from 'react';

import { adsShape } from '../../api';
import type { BarRow } from './ad-digest';

export interface Series { key: string; color: string }

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="dg-legend">
      {series.map((s) => (
        <span key={s.key}><i style={{ background: s.color }} />{adsShape.words(s.key)}</span>
      ))}
    </div>
  );
}

export default function StackedBars({ rows, series, share = false, labelOf = (r) => adsShape.words(r.label) }: { rows: BarRow[]; series: Series[]; share?: boolean; labelOf?: (row: BarRow) => string }) {
  const [tip, setTip] = useState<{ row: string; text: string } | null>(null);
  const totals = rows.map((r) => r.parts.reduce((sum, p) => sum + p.value, 0));
  const max = Math.max(1, ...totals);
  if (rows.length === 0) return <p className="dg-note">Nothing to count yet.</p>;
  return (
    <div className="dg-bars" onMouseLeave={() => setTip(null)}>
      {rows.map((row, i) => {
        const sum = totals[i]!;
        return (
          <div className="dg-row" key={row.label}>
            <span className="dg-lab">{labelOf(row)}</span>
            <span className="dg-track">
              <span className="dg-bar" style={{ width: `${(share ? 1 : sum / max) * 80}%` }}>
                {series.map((s) => {
                  const part = row.parts.find((p) => p.key === s.key);
                  if (!part || part.value === 0) return null;
                  const text = `${adsShape.words(s.key)}: ${part.value} (${Math.round((part.value / sum) * 100)}%)`;
                  return (
                    <span
                      key={s.key}
                      tabIndex={0}
                      style={{ flex: part.value, background: s.color }}
                      onMouseEnter={() => setTip({ row: labelOf(row), text })}
                      onFocus={() => setTip({ row: labelOf(row), text })}
                      onBlur={() => setTip(null)}
                    />
                  );
                })}
              </span>
              <span className="dg-val">{row.note ?? (share ? `${sum} ads` : sum)}</span>
            </span>
          </div>
        );
      })}
      {tip && (
        <div className="dg-tip" role="status">
          <div className="dim">{tip.row}</div>
          {tip.text}
        </div>
      )}
    </div>
  );
}
