import { useEffect, useState } from 'react';

import { api, DELIVERED_STATUSES, type ProductTruthPacket, type RunDetail, type RunSummary, type StagePacket } from './api';
import { Link, paths } from './route';
import { StageOneTiles } from './run-view/stage-one-tiles';
import { ProductTruthTiles } from './run-view/truth/ProductTruthTiles';
import { VoiceAnalysis } from './run-view/voice/VoiceAnalysis';
import { STAGE_NAMES } from './stages';
import { useProduct } from './use-products';

function StageResult({ summary, requiredFields, onError }: { summary: RunSummary; requiredFields: Record<string, string[]>; onError: (message: string) => void }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  useEffect(() => {
    api.run(summary.id).then(setRun).catch((err: Error) => onError(err.message));
  }, [summary.id, onError]);
  const stage = summary.stage as 1 | 2 | 3;
  const packet = run?.packet ?? null;
  return (
    <section className="product-stage">
      <div className="plan-head">
        <h3>
          Stage {stage} · {STAGE_NAMES[stage]}
        </h3>
        <span className={`status ${summary.status}`}>{summary.status}</span>
        <Link to={paths.run(summary.product_id, summary.id)} className="d">
          Full page →
        </Link>
      </div>
      {!run && <div className="muted small">Loading…</div>}
      {run && stage === 1 && packet && packet.stage !== 2 && (
        <div className="tiles">
          <StageOneTiles runId={run.id} packet={packet as StagePacket} nodes={new Set(run.nodes ?? [])} listings={run.listings ?? []} requiredFields={requiredFields} />
        </div>
      )}
      {run && stage === 2 && packet && packet.stage === 2 && (
        <div className="tiles">
          <ProductTruthTiles runId={run.id} packet={packet as ProductTruthPacket} />
        </div>
      )}
      {run && stage === 3 && (
        <div className="voice-tile">
          <VoiceAnalysis runId={run.id} finished />
        </div>
      )}
    </section>
  );
}

export default function ProductResults({ productId, requiredFields, onError }: { productId: string; requiredFields: Record<string, string[]>; onError: (message: string) => void }) {
  const { runs } = useProduct(productId, onError);
  const newest = (stage: number) => runs.filter((r) => r.stage === stage && !r.is_task && DELIVERED_STATUSES.has(r.status)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const shown = [1, 2, 3].map(newest).filter((r): r is RunSummary => !!r);
  const tasks = runs.filter((r) => r.is_task && !DELIVERED_STATUSES.has(r.status)).length;
  if (shown.length === 0) return <p className="muted small">Nothing delivered yet{tasks > 0 ? `; ${tasks} task${tasks === 1 ? '' : 's'} still running` : ''}. A plan's stage 1 shows here once its tasks are combined.</p>;
  return (
    <div className="product-results">
      {shown.map((summary) => (
        <StageResult key={summary.id} summary={summary} requiredFields={requiredFields} onError={onError} />
      ))}
    </div>
  );
}
