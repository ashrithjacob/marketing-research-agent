/** Hand-rolled SVG visuals for packet numbers — no chart library. */

function formatNumber(value: number, unit?: string): string {
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1e9) body = `${(value / 1e9).toFixed(2)}B`;
  else if (abs >= 1e6) body = `${(value / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M`;
  else if (abs >= 1e3) body = `${(value / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
  else body = `${value}`;
  if (unit === 'USD') return `$${body}`;
  if (unit === '%') return `${value}%`;
  return body;
}

function prettyMetric(metric: string): string {
  return metric
    .replace(/^related_topic_growth_/, 'topic growth · ')
    .replace(/^country_cagr_/, 'CAGR · ')
    .replace(/^end_use_share_/, 'share · ')
    .replace(/_/g, ' ');
}

export interface BarItem {
  label: string;
  value: number;
  display: string;
}

/** Horizontal bars, longest = full width. Numbers stay honest: no invented axes. Drawn in HTML, so its text is the page's size at any width. */
export function BarList({ items, unit }: { items: BarItem[]; unit?: string }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  return (
    <div className="barlist" role="img" aria-label="bar chart">
      {items.map((item, index) => (
        <div key={index} className="barlist-row">
          <span className="barlist-label">{item.label}</span>
          <span className="barlist-track">
            <span className="barlist-fill" style={{ width: `${max > 0 ? Math.max((item.value / max) * 100, 1) : 1}%` }} />
          </span>
          <span className="barlist-value">{item.display || formatNumber(item.value, unit)}</span>
        </div>
      ))}
    </div>
  );
}

/** Numeric measurements of one metric family, laid out as bars. */
export function MeasurementBars({
  measurements,
}: {
  measurements: { metric: string; value: number | string; unit?: string; period?: string }[];
}) {
  const numeric = measurements.filter((m) => typeof m.value === 'number');
  if (numeric.length === 0) return null;
  const byMetric = new Map<string, typeof numeric>();
  for (const m of numeric) {
    const list = byMetric.get(m.metric) ?? [];
    list.push(m);
    byMetric.set(m.metric, list);
  }
  return (
    <div className="chart-group">
      {[...byMetric.entries()].map(([metric, list]) => (
        <div key={metric} className="chart">
          <div className="chart-title">{prettyMetric(metric)}</div>
          <BarList
            unit={list[0].unit}
            items={list.map((m) => ({
              label: m.period ? shortenPeriod(m.period) : list.length > 1 ? metric : '',
              value: m.value as number,
              display: `${formatNumber(m.value as number, m.unit)}${m.unit && m.unit !== 'USD' && m.unit !== '%' ? ` ${m.unit}` : ''}`,
            }))}
          />
        </div>
      ))}
    </div>
  );
}

function shortenPeriod(period: string): string {
  if (period.length <= 34) return period;
  return `${period.slice(0, 33)}…`;
}
