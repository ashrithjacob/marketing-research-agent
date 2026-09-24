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
  open: openProp,
  onToggle,
}: {
  label: string;
  sub?: string;
  chips?: ReactNode;
  preview?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const [openSelf, setOpenSelf] = useState(defaultOpen);
  const open = openProp ?? openSelf;
  const toggle = () => (onToggle ? onToggle() : setOpenSelf((o) => !o));
  return (
    <div className={`tile ${open ? 'open' : ''}`}>
      <div
        className="tile-head"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <div className="tile-heading">
          <span className="tile-label">{label}</span>
          {sub && <span className="tile-sub">{sub}</span>}
        </div>
        <div className="tile-chips" onClick={(e) => e.stopPropagation()}>
          {chips}
        </div>
        <span className="tile-toggle" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </div>
      {preview && !open && <div className="tile-preview">{preview}</div>}
      {open && <div className="tile-body">{children}</div>}
    </div>
  );
}

export function Chip({
  children,
  tone,
  onClick,
  active,
}: {
  children: ReactNode;
  tone?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  if (!onClick) return <span className={`tile-chip ${tone ?? ''}`}>{children}</span>;
  return (
    <button
      className={`tile-chip chip-btn ${active ? 'active' : ''} ${tone ?? ''}`}
      onClick={onClick}
      title={active ? 'Click again to see everything' : 'Show only this'}
    >
      {children}
    </button>
  );
}

/** The gaps that belong to one tile, so a hole in the data sits next to the data. */
export function TileGaps({ gaps, force }: { gaps: Gap[]; force?: boolean }) {
  if (gaps.length === 0) {
    return force ? <p className="muted">No data gaps here — everything wanted was captured.</p> : null;
  }
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
