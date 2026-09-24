import { useState, type ReactNode } from 'react';
import type { Gap } from '../api';

/** A dashboard tile: headline figures visible, full values behind one click. */
export function Tile({
  label,
  sub,
  chips,
  preview,
  children,
  defaultOpen = false,
}: {
  label: string;
  sub?: string;
  chips?: ReactNode;
  preview?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`tile ${open ? 'open' : ''}`}>
      <button className="tile-head" onClick={() => setOpen((o) => !o)}>
        <div className="tile-heading">
          <span className="tile-label">{label}</span>
          {sub && <span className="tile-sub">{sub}</span>}
        </div>
        {chips && <div className="tile-chips">{chips}</div>}
        <span className="tile-toggle" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {preview && !open && <div className="tile-preview">{preview}</div>}
      {open && <div className="tile-body">{children}</div>}
    </div>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`tile-chip ${tone ?? ''}`}>{children}</span>;
}

/** The gaps that belong to one tile, so a hole in the data sits next to the data. */
export function TileGaps({ gaps }: { gaps: Gap[] }) {
  if (gaps.length === 0) return null;
  return (
    <div className="tile-gaps">
      <div className="tile-gaps-head">
        Data gaps <span>{gaps.length}</span>
      </div>
      {gaps.map((gap, index) => (
        <div key={index} className="tile-gap">
          <div className="tile-gap-missing">{gap.missing}</div>
          {gap.would_need && <div className="tile-gap-need">To close it: {gap.would_need}</div>}
        </div>
      ))}
    </div>
  );
}
