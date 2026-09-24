import { api, briefLabel, type Brief, type Judgement, type ResearchNode, type RunDetail, type RunSummary, type StagePacket } from '../api';
import StageRail, { NODE_ORDER, scopeLabel } from '../StageRail';
import { billedText, pricingNote } from './now';

/** Two briefs name the same subject. Mirrors `Briefs.key` in `server/src/domain/brief.ts`. */
function sameSubject(a: Brief | undefined, b: Brief | undefined): boolean {
  const key = (brief: Brief | undefined): string => {
    const url = brief?.url?.trim();
    if (url) return `site:${url.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0].toLowerCase()}`;
    return `product:${(brief?.product ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  };
  return key(a) === key(b);
}

export function RailColumn({
  run,
  runs,
  runId,
  live,
  packet,
  judgements,
  onSelectRun,
  onRunNode,
}: {
  run: RunDetail;
  runs: RunSummary[];
  runId: string;
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
      stageTwoReady={runs.some(
        (r) =>
          r.status === 'completed' &&
          (r.stage ?? 1) === 1 &&
          sameSubject(r.brief, run.brief),
      )}
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

    <h3 style={{ marginTop: 18 }}>Runs</h3>
    <div className="runlist">
      {runs.map((r) => (
        <div
          key={r.id}
          className={`runrow ${r.id === runId ? 'active' : ''}`}
          onClick={() => onSelectRun(r.id)}
        >
          <div className="runrow-top">
            <span className="runrow-title">{briefLabel(r.brief)}</span>
            <span className={`status ${r.status}`}>{r.status}</span>
          </div>
          <div className="runrow-sub">
            {r.nodes && r.nodes.length < NODE_ORDER.length && (
              <span className="runrow-scope">{scopeLabel(r.nodes)} · </span>
            )}
            {r.counts.competitors &&
              r.counts.competitors.direct + r.counts.competitors.indirect > 0 &&
              `${r.counts.competitors.direct} direct · ${r.counts.competitors.indirect} indirect · `}
            {r.counts.sources} sources · {r.counts.excerpts} excerpts ·{' '}
            {r.counts.gaps} gaps
          </div>
        </div>
      ))}
    </div>
  </div>
  );
}
