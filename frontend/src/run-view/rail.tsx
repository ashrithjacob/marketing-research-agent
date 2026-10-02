import type { ReactNode } from 'react';
import { api, TERMINAL_STATUSES, type Judgement, type ProductTruthPacket, type ResearchNode, type RunDetail, type RunSummary, type StagePacket } from '../api';
import StageRail, { type StageProgress } from '../StageRail';
import { scopeLabel, type CollectingStage } from '../stages';
import { CostTable } from './CostTable';
import { runStage } from './now';
import { useCosts } from './use-costs';

/** Where `run` stands: everything is counted on one stage-1 run — the run itself, or the one it built on — never on another stage-1 run's later stages. */
export function subjectProgress(runs: RunSummary[], run: RunSummary): StageProgress {
  const anchor = runStage(run) === 1 ? run.id : run.source_run_id;
  const stageOneRun = runStage(run) === 1 ? run : runs.find((r) => r.id === run.source_run_id);
  const on = (stage: CollectingStage) =>
    runs
      .filter((r) => runStage(r) === stage && (runStage(run) === stage ? r.id === run.id : r.source_run_id === anchor))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pick = (list: RunSummary[]) =>
    list.find((r) => !TERMINAL_STATUSES.has(r.status)) ?? list.find((r) => r.status === 'completed') ?? list[0];
  const truth = on(2);
  const mining = on(3);
  const newestStageOne = runs
    .filter((r) => runStage(r) === 1 && r.status === 'completed')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const superseded = runStage(run) !== 1 && !!newestStageOne && newestStageOne.id !== run.source_run_id;
  return {
    done: { 1: stageOneRun?.status === 'completed', 2: truth.some((r) => r.status === 'completed'), 3: mining.some((r) => r.status === 'completed') },
    live: { 1: false, 2: truth.some((r) => !TERMINAL_STATUSES.has(r.status)), 3: mining.some((r) => !TERMINAL_STATUSES.has(r.status)) },
    runIds: { 1: stageOneRun?.id, 2: pick(truth)?.id, 3: pick(mining)?.id },
    ...(superseded ? { newerStageOne: newestStageOne } : {}),
  };
}

export function RailColumn({
  run,
  runs,
  nav,
  live,
  packet,
  judgements,
  onSelectRun,
  onRunNode,
}: {
  run: RunDetail;
  runs: RunSummary[];
  nav: ReactNode;
  live: boolean;
  packet: StagePacket | ProductTruthPacket | null;
  judgements: Judgement[];
  onSelectRun: (id: string) => void;
  onRunNode: (node: ResearchNode) => void;
}) {
  const costs = useCosts(run.id, live);
  return (
  <div className="rail-col">
    <StageRail
      status={run.status}
      nodes={packet?.nodes ?? []}
      saturation={packet && 'saturation' in packet ? packet.saturation : []}
      scope={run.nodes ?? []}
      onRunNode={onRunNode}
      progress={subjectProgress(runs, run)}
      onSelectRun={onSelectRun}
    />

    <h3 style={{ marginTop: 18 }}>
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
        Model <span>{run.model || 'unrecorded'}</span>
      </div>
      <div>
        Started <span>{new Date(run.created_at).toLocaleString()}</span>
      </div>
      <div>
        Tokens{' '}
        <span>
          {run.usage?.totalTokens
            ? `${(run.usage.totalTokens / 1000).toFixed(0)}k`
            : '—'}
        </span>
      </div>
    </div>
    {costs && costs.rows.length > 0 && <CostTable report={costs} />}

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
