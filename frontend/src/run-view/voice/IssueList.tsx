import { useState } from 'react';
import type { Issue, IssueQuote } from '../../api';
import { Quotes } from './Quotes';

export interface IssueRow {
  issue: Issue;
  mentions: number;
  score: number;
  share?: number;
  quotes: IssueQuote[];
}

export function IssueList({ rows, tone }: { rows: IssueRow[]; tone: 'worst' | 'best' }) {
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(...rows.map((row) => row.score), 0);
  if (rows.length === 0) return <p className="muted">None raised.</p>;
  return (
    <ol className={`issue-list ${tone}`}>
      {rows.map((row, index) => {
        const expanded = open === row.issue.id;
        return (
          <li key={row.issue.id}>
            <button
              className="issue-row"
              onClick={() => setOpen(expanded ? null : row.issue.id)}
              title={row.issue.description}
            >
              <span className="issue-rank">{index + 1}</span>
              <span className="issue-main">
                <span className="issue-label">
                  {row.issue.label}
                  {row.issue.kind === 'request' && <span className="pill">asked for</span>}
                </span>
                <span className="issue-bar">
                  <i style={{ width: `${max > 0 ? (row.score / max) * 100 : 0}%` }} />
                </span>
              </span>
              <span className="issue-count">
                {row.mentions} review{row.mentions === 1 ? '' : 's'}
                {row.share != null && ` · ${Math.round(row.share * 100)}%`}
              </span>
              <span className="issue-toggle" aria-hidden>
                {expanded ? '−' : '+'}
              </span>
            </button>
            {expanded && <Quotes quotes={row.quotes} />}
          </li>
        );
      })}
    </ol>
  );
}
