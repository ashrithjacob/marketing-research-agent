import type { StageInfo, StageState } from '../api';
import { StatusBadge } from './badges';

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
              {state?.summary && <p className="small">{state.summary}</p>}
              {state?.error && <p className="small error">{state.error}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
