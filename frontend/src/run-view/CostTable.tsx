import type { CostCell, CostColumn, CostReport, CostRow } from '../api';

const COLUMNS: { key: CostColumn; label: string }[] = [
  { key: 'llm', label: 'LLM' },
  { key: 'apify', label: 'Apify' },
  { key: 'parallel', label: 'Parallel' },
  { key: 'trendtrack', label: 'Trendtrack' },
  { key: 'page_reading', label: 'Pages' },
];

function money(cell: CostCell | undefined): string {
  if (!cell) return '—';
  if (cell.usd === null) return 'unpriced';
  return `$${cell.usd.toFixed(cell.usd < 0.01 ? 4 : 3)}`;
}

function who(row: CostRow): string {
  return row.agent_id ?? 'run';
}

/** One row's spend, column by column, each with how it was counted. */
export function CostCells({ row }: { row: CostRow }) {
  return (
    <div className="cost-cells">
      {COLUMNS.filter((c) => row.cells[c.key]).map((c) => (
        <span key={c.key} title={row.cells[c.key]!.detail}>
          {c.label} <b>{money(row.cells[c.key])}</b>
          <span className="muted"> {row.cells[c.key]!.detail}</span>
        </span>
      ))}
      <span>
        Total <b>${row.total_usd.toFixed(4)}</b>
      </span>
    </div>
  );
}

/** What each agent and the run's own code spent, per service: OpenRouter as billed, Apify as billed, Parallel at list price, Trendtrack in credits. A dash is a service the agent has no tool for. */
export function CostTable({ report }: { report: CostReport }) {
  const shown = COLUMNS.filter((c) => report.totals[c.key]);
  return (
    <table className="cost-table">
      <thead>
        <tr>
          <th />
          {shown.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {report.rows.map((row) => (
          <tr key={who(row)}>
            <td>{who(row)}</td>
            {shown.map((c) => (
              <td key={c.key} title={row.cells[c.key]?.detail ?? 'no tool for this service'}>
                {money(row.cells[c.key])}
              </td>
            ))}
            <td>${row.total_usd.toFixed(4)}</td>
          </tr>
        ))}
        <tr className="cost-total">
          <td>total</td>
          {shown.map((c) => (
            <td key={c.key} title={report.totals[c.key]?.detail}>
              {money(report.totals[c.key])}
            </td>
          ))}
          <td>${report.total_usd.toFixed(4)}</td>
        </tr>
      </tbody>
    </table>
  );
}
