import type { ReactNode } from 'react';

import type { StageInfo, StageState } from '../api';
import { StatusBadge } from './badges';

export interface Chip {
  label: string;
  value: string | number;
  target?: string;
  onClick?: () => void;
  tone?: 'warn';
}

export type BarOf = (chips: Chip[]) => ReactNode;

function jump(chip: Chip) {
  chip.onClick?.();
  if (chip.target) document.getElementById(chip.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function when(state: StageState | undefined): string {
  const at = state?.ended_at || state?.started_at;
  if (!at) return '';
  const time = new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return state?.ended_at ? time : `since ${time}`;
}

export default function StageBar({ stage, state, chips }: { stage: StageInfo; state: StageState | undefined; chips: Chip[] }) {
  const stored = state?.status ?? (stage.built ? 'pending' : 'not_built');
  const status = stored === 'not_built' && stage.built ? 'never_run' : stored;
  return (
    <div className={`stage-bar status-${status}`}>
      <div className="stage-bar-head">
        <span className="stage-bar-n">{stage.number}</span>
        <strong>{stage.title}</strong>
        <span title={state?.summary || undefined}>
          <StatusBadge status={status} />
        </span>
        <span className="dim small">{when(state)}</span>
      </div>
      {state?.error ? (
        <p className="stage-bar-error small error">{state.error}</p>
      ) : (
        chips.length > 0 && (
          <div className="stage-bar-chips">
            {chips.map((chip) => (
              <button key={chip.label} className={`stage-chip ${chip.tone ?? ''}`} onClick={() => jump(chip)}>
                <span className="stage-chip-value">{chip.value}</span>
                <span className="stage-chip-label">{chip.label}</span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
