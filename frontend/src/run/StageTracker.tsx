import { useState } from 'react';

import type { StageInfo, StageState } from '../api';
import { StatusBadge } from './badges';

function Clamped({ text, className }: { text: string; className: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 180;
  return (
    <p className={`small ${className} ${long && !open ? 'clamped' : ''}`}>
      {text}
      {long && (
        <button className="link" onClick={() => setOpen(!open)}>
          {open ? 'less' : 'more'}
        </button>
      )}
    </p>
  );
}

export default function StageTracker({ stages, states }: { stages: StageInfo[]; states: Record<string, StageState> }) {
  return (
    <ol className="stages">
      {stages.map((stage) => {
        const state = states[stage.name];
        const status = state?.status ?? (stage.built ? 'pending' : 'not_built');
        return (
          <li key={stage.name} className={`stage status-${status}`}>
            <span className="n">{stage.number}</span>
            <div>
              <div className="stage-title">
                {stage.title} <StatusBadge status={status} />
              </div>
              {state?.summary && <Clamped text={state.summary} className="" />}
              {state?.error && <Clamped text={state.error} className="error" />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
