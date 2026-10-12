import type { ReactNode } from 'react';
import { factText } from '../api';

/** One field as a closed row: its name and a one-line preview; opened, the whole value. */
export function Fold({ label, preview, tone, children }: { label: string; preview: unknown; tone?: string; children?: ReactNode }) {
  const text = factText(preview).preview;
  return (
    <details className="kv-row fact">
      <summary>
        <span className="k">{label}</span>
        <span className={`fact-preview ${tone ?? ''}`}>{text || '—'}</span>
      </summary>
      <div className="v">{children ?? text}</div>
    </details>
  );
}

/** A titled card that holds one item's folds: an active, a market, a price. */
export function FoldCard({ title, chips, glance, children }: { title: string; chips?: ReactNode; glance?: string; children: ReactNode }) {
  return (
    <div className="pt-card">
      <div className="pt-card-head">
        <b>{title}</b>
        {chips}
      </div>
      {glance && <div className="pt-card-glance">{glance}</div>}
      <div className="kv">{children}</div>
    </div>
  );
}

/** Lines laid out as a list, one per line. */
export function Lines({ lines }: { lines: string[] }) {
  if (lines.length === 0) return <span className="muted">none recorded</span>;
  return (
    <ul className="fact-items">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
