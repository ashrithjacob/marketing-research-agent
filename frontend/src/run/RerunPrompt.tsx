import { useState } from 'react';

import { FINAL_STATUSES, runs, type Run, type StageInfo } from '../api';
import { StatusBadge } from './badges';

function why(status: string, error: string, summary: string): string {
  if (status === 'not_built' || status === 'pending') return 'built since this run, never run on it';
  return error || summary || status;
}

export default function RerunPrompt({ run, stages, onDone, onError }: { run: Run; stages: StageInfo[]; onDone: () => void; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  if (!FINAL_STATUSES.has(run.status) || !run.product_id) return null;
  const unfinished = stages.filter((stage) => stage.built && run.stage_status[stage.name]?.status !== 'completed');
  if (unfinished.length === 0) return null;

  async function rerun() {
    setBusy(true);
    try {
      await runs.rerun(run.id);
      onDone();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel rerun">
      <h2>{unfinished.length === 1 ? 'One stage did not finish' : `${unfinished.length} stages did not finish`}</h2>
      <ul className="rerun-list">
        {unfinished.map((stage) => {
          const state = run.stage_status[stage.name];
          return (
            <li key={stage.name}>
              <span className="n">{stage.number}</span>
              <strong>{stage.title}</strong> <StatusBadge status={!state || state.status === 'not_built' ? 'never_run' : state.status} />
              <div className="small dim why">{why(state?.status ?? 'not_built', state?.error ?? '', state?.summary ?? '')}</div>
            </li>
          );
        })}
      </ul>
      <p className="small dim">Completed stages are kept and not paid for again. Rerunning spends model tokens, and for stage 4 TrendTrack credits (up to 150 ads).</p>
      <button className="primary" disabled={busy} onClick={rerun}>
        {busy ? 'Starting…' : unfinished.length === 1 ? 'Rerun this stage' : `Rerun these ${unfinished.length} stages`}
      </button>
    </section>
  );
}
