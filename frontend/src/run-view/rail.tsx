import type { ReactNode } from 'react';
import { api, DELIVERED_STATUSES, type Judgement, type RunDetail, type RunSummary } from '../api';
import { scopeLabel } from '../stages';
import { runStage } from './now';

/** On a product-truth or review-mining run: a delivered stage-1 run newer than the one it built on, so what it found is out of date. */
export function newerStageOne(runs: RunSummary[], run: RunSummary): RunSummary | undefined {
  if (runStage(run) === 1) return undefined;
  const newest = runs
    .filter((r) => runStage(r) === 1 && !r.is_task && DELIVERED_STATUSES.has(r.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return newest && newest.id !== run.source_run_id ? newest : undefined;
}

export function RailColumn({
  run,
  nav,
  judgements,
}: {
  run: RunDetail;
  nav: ReactNode;
  judgements: Judgement[];
}) {
  return (
  <div className="rail-col">
    <h3>
      Run{' '}
      <a
        className="logs-link"
        href={api.logsUrl(run.id)}
        target="_blank"
        rel="noreferrer"
        title="Everything this run did — every action, LLM call, prompt, answer, token and cost — in a new tab"
      >
        Activity ↗
      </a>
    </h3>
    <div className="runmeta">
      <div>
        Scope <span>{scopeLabel(run.nodes ?? [])}</span>
      </div>
      <div>
        Markets <span>{run.brief?.market || 'anywhere'}</span>
      </div>
      <div>
        Started <span>{new Date(run.created_at).toLocaleString()}</span>
      </div>
    </div>

    <h3 style={{ marginTop: 18 }}>
      Standing judgements <span className="n">{judgements.length}</span>
    </h3>
    {judgements.length === 0 && (
      <p className="muted">None yet. “Step in” to correct the agent.</p>
    )}
    {judgements.map((judgement) => (
      <div key={judgement.id} className="judge">
        <div className="w">{judgement.kind.replace('_', ' ')}</div>
        <div>{judgement.text}</div>
        <div className="used">
          applied {judgement.applied_count} time
          {judgement.applied_count === 1 ? '' : 's'}
        </div>
      </div>
    ))}

    {nav}
  </div>
  );
}
