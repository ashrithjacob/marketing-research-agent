import type { ReactNode } from 'react';
import { api, TERMINAL_STATUSES, type Judgement, type ResearchNode, type RunDetail, type RunSummary, type StagePacket } from '../api';
import StageRail, { scopeLabel, type StageProgress } from '../StageRail';
import { billedText, pricingNote, runStage } from './now';

/** Where `run`'s product stands across `runs`, every run of that product. */
export function subjectProgress(runs: RunSummary[], run: RunSummary): StageProgress {
  const stageTwo = runs
    .filter((r) => runStage(r) === 2)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const stageTwoRun =
    stageTwo.find((r) => !TERMINAL_STATUSES.has(r.status)) ??
    stageTwo.find((r) => r.status === 'completed') ??
    stageTwo[0];
  return {
    stageOneDone: runs.some((r) => r.status === 'completed' && runStage(r) === 1),
    stageTwoDone: runs.some((r) => r.status === 'completed' && runStage(r) === 2),
    stageTwoLive: runs.some((r) => runStage(r) === 2 && !TERMINAL_STATUSES.has(r.status)),
    runIds: {
      1: runStage(run) === 1 ? run.id : stageOneRunFor(runs, run)?.id,
      2: runStage(run) === 2 ? run.id : stageTwoRun?.id,
    },
  };
}

/** The stage-1 run a stage-2 run mined from, which its rail's stage-1 header opens: the newest completed one of its product's `runs` that predates it. Mirrors `StageTwoHandoff` in `server/src/agent/stage-two-handoff.ts`. */
export function stageOneRunFor(runs: RunSummary[], run: RunSummary): RunSummary | undefined {
  return runs
    .filter(
      (r) =>
        runStage(r) === 1 &&
        r.status === 'completed' &&
        r.created_at <= run.created_at,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
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
  packet: StagePacket | null;
  judgements: Judgement[];
  onSelectRun: (id: string) => void;
  onRunNode: (node: ResearchNode) => void;
}) {
  return (
  <div className="rail-col">
    <StageRail
      status={run.status}
      nodes={packet?.nodes ?? []}
      saturation={packet?.saturation ?? []}
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
      <div title={pricingNote(run.usage?.pricing)}>
        Calc. cost{' '}
        <span>
          {run.usage?.cost?.total ? `$${run.usage.cost.total.toFixed(4)}` : '—'}
          {run.usage?.pricing?.source === 'pi-ai-snapshot' ? ' (snapshot prices)' : ''}
        </span>
      </div>
      <div title="What OpenRouter charged, read back per turn from /generation">
        Billed{' '}
        <span>{billedText(run.usage?.billed, live)}</span>
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
