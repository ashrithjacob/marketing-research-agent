import { useState } from 'react';

import { FINAL_STATUSES, runs, type Run, type StageInfo } from '../api';
import StageTracker from './StageTracker';

const PAID_SERVICES: Record<string, string> = { product_market: 'web search and TrendTrack shop data', reviews: 'review collection', competitor_ads: 'TrendTrack ad credits' };

export default function StagesPanel({ run, stages, onDone, onError }: { run: Run; stages: StageInfo[]; onDone: () => void; onError: (message: string) => void }) {
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const canRerun = FINAL_STATUSES.has(run.status) && Boolean(run.product_id);
  const built = stages.filter((stage) => stage.built);
  const unfinished = built.filter((stage) => run.stage_status[stage.name]?.status !== 'completed').map((stage) => stage.name);
  const running = chosen ? built.filter((stage) => chosen.includes(stage.name) || unfinished.includes(stage.name)) : [];
  const services = running.map((stage) => PAID_SERVICES[stage.name]).filter(Boolean);

  async function rerun() {
    if (!chosen) return;
    setBusy(true);
    try {
      await runs.rerun(run.id, chosen);
      setChosen(null);
      onDone();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {canRerun && (
        <div className="stages-bar">
          <button className="link" onClick={() => setChosen(built.map((stage) => stage.name))}>
            Rerun all stages
          </button>
        </div>
      )}
      {chosen && (
        <section className="panel rerun-confirm">
          <p>
            <strong>Rerun {running.length === 1 ? 'stage' : 'stages'} {running.map((stage) => stage.number).join(', ')}:</strong> {running.map((stage) => stage.title).join(' · ')}.
          </p>
          <p className="small dim">
            A stage that uses another's results reruns with it, and what these stages found before is replaced. Other stages are kept. This spends model tokens{services.length > 0 ? `, ${services.join(', ')}` : ''}.
          </p>
          <div className="row">
            <button className="primary" disabled={busy} onClick={rerun}>
              {busy ? 'Starting…' : 'Rerun'}
            </button>
            <button className="ghost" disabled={busy} onClick={() => setChosen(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}
      <StageTracker stages={stages} states={run.stage_status} onRerun={canRerun ? (stage) => setChosen(stage.reruns) : undefined} />
    </>
  );
}
