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

/** What each agent and the run's own code spent, one block each so it fits a narrow column: the total, then each service it can spend in. OpenRouter and Apify as billed, Parallel at list price, Trendtrack in credits. */
export function CostTable({ report }: { report: CostReport }) {
  const totals: CostRow = { agent_id: null, cells: report.totals, total_usd: report.total_usd };
  return (
    <div className="cost-list">
      {report.rows.map((row) => (
        <CostBlock key={who(row)} name={who(row)} row={row} />
      ))}
      <CostBlock name="total" row={totals} total />
    </div>
  );
}

function CostBlock({ name, row, total }: { name: string; row: CostRow; total?: boolean }) {
  return (
    <div>
      <div className={`cost-agent${total ? ' total' : ''}`}>
        <span>{name}</span>
        <span>${row.total_usd.toFixed(4)}</span>
      </div>
      <div className="cost-parts">
        {COLUMNS.filter((c) => row.cells[c.key]).map((c) => (
          <span key={c.key} title={row.cells[c.key]!.detail}>
            {c.label} {money(row.cells[c.key])}
          </span>
        ))}
      </div>
    </div>
  );
}
