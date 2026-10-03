import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  TERMINAL_STATUSES,
  type Judgement,
  type ResearchNode,
  type RunDetail,
  type ProductTruthPacket,
  type RunSummary,
  type StagePacket,
} from './api';
import { ChatText } from './FileBox';
import { nowPanel, runStage } from './run-view/now';
import { RailColumn, subjectProgress } from './run-view/rail';
import { StageOneTiles } from './run-view/stage-one-tiles';
import { ProductTruthTiles } from './run-view/truth/ProductTruthTiles';
import { useRunStream } from './run-view/use-run-stream';
import { OutdatedVoice } from './run-view/outdated-voice';
import { VoiceAnalysis } from './run-view/voice/VoiceAnalysis';

const NEXT_STAGE: Record<2 | 3, { name: string; sub: string; node: ResearchNode }> = {
  2: {
    name: 'Product truth',
    sub: 'Stage 1 is in. Assess the product in isolation — its formula, doses, claim limits and economics. You enter its landed cost first.',
    node: 'mechanism',
  },
  3: {
    name: 'Review mining',
    sub: 'Product truth is in. Mine verbatim customer language from the reviews of the product stage 1 found — you approve the plan before anything runs.',
    node: 'review_mining',
  },
};

export default function RunView({
  runId,
  runs,
  nav,
  judgementsRev,
  requiredFields,
  onSelectRun,
  onChanged,
  onRunNode,
}: {
  runId: string;
  runs: RunSummary[];
  nav: ReactNode;
  judgementsRev: number;
  requiredFields: Record<string, string[]>;
  onSelectRun: (id: string) => void;
  onChanged: () => void;
  onRunNode: (node: ResearchNode) => void;
}) {
  const [loaded, setLoaded] = useState<RunDetail | null>(null);
  const [judgements, setJudgements] = useState<Judgement[]>([]);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setLoaded(await api.run(runId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [runId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    api.judgements().then(({ data }) => setJudgements(data)).catch(() => undefined);
  }, [judgementsRev]);

  const run = loaded && loaded.id === runId ? loaded : null;
  const packet = run?.packet ?? null;
  const live = !!run && !TERMINAL_STATUSES.has(run.status);
  const [from, setFrom] = useState<{ runId: string; after: number } | null>(null);
  useEffect(() => {
    if (run && from?.runId !== runId) setFrom({ runId, after: run.last_event_id });
  }, [run, runId, from]);
  const listenFrom = live && from?.runId === runId ? from.after : null;
  const { lastTool, reconnecting } = useRunStream(runId, listenFrom, reload, onChanged, setError);

  const sources = packet?.sources ?? [];
  const admitted = useMemo(() => sources.filter((s) => s.admitted), [sources]);
  const unarchived = useMemo(
    () => admitted.filter((s) => !s.archived).length,
    [admitted],
  );

  if (!run) return <div className="empty">Loading run…</div>;

  const now = nowPanel(run, live, lastTool);
  const progress = subjectProgress(runs, run);
  const stage = runStage(run);
  const next = stage < 3 && run.status === 'completed' ? ((stage + 1) as 2 | 3) : null;
  const nextStage = next && !progress.done[next] && !progress.live[next] ? NEXT_STAGE[next] : null;
  const nodesInRun = new Set((run.nodes ?? packet?.nodes.map((n) => n.node) ?? []) as string[]);
  const stagePacket = packet && packet.stage !== 2 ? (packet as StagePacket) : null;
  const truthPacket = packet && packet.stage === 2 ? (packet as ProductTruthPacket) : null;

  return (
    <div className="cols two">
      <RailColumn
        run={run}
        runs={runs}
        nav={nav}
        live={live}
        packet={packet}
        judgements={judgements}
        onSelectRun={onSelectRun}
        onRunNode={onRunNode}
      />

      <div className="mid">
        {error && <div className="error">{error}</div>}
        {reconnecting && <div className="warn">Live updates paused: {reconnecting}</div>}

        {run.status === 'invalid' && (
          <div className="error">
            <b>{packet ? 'Some checks failed.' : 'Packet rejected.'}</b> {run.error}
            <div className="error-note">
              {packet
                ? 'Everything that passed is shown below. Rows that broke a check were set aside as gaps; the problems above belong to no single row.'
                : `The agents finished and what they produced broke the stage-${stage} contract. The raw output is below.`}
            </div>
          </div>
        )}
        {run.status === 'failed' && <div className="error">{run.error}</div>}

        <section>
          <h3>
            Now <span className="n">{live ? 'live' : 'finished'}</span>
          </h3>
          <div className="now">
            <span className={`pulse ${live ? '' : 'off'}`} />
            <div className="txt">
              <b>{now.title}</b>
              <div className="sub">{now.sub}</div>
            </div>
            <a className="ghost logs-back" href={api.logsUrl(run.id)} target="_blank" rel="noreferrer">
              Activity log ↗
            </a>
          </div>
          {nextStage && (
            <div className="next-stage">
              <div className="txt">
                <b>Next: Stage {next} · {nextStage.name}</b>
                <div className="sub">{nextStage.sub}</div>
              </div>
              <button className="primary" onClick={() => onRunNode(nextStage.node)}>
                Start stage {next} →
              </button>
            </div>
          )}
        </section>

        {unarchived > 0 && (
          <div className="warn">
            {unarchived} admitted source{unarchived === 1 ? '' : 's'} not archived —
            those spans cannot be checked against the page they came from.
          </div>
        )}

        {stagePacket && stage === 1 && (
          <div className="tiles">
            <StageOneTiles runId={runId} packet={stagePacket} nodes={nodesInRun} listings={run?.listings ?? []} requiredFields={requiredFields} />
          </div>
        )}
        {truthPacket && (
          <div className="tiles">
            {progress.newerStageOne && (
              <div className="warn">Stage 1 was rerun on {new Date(progress.newerStageOne.created_at).toLocaleString()}; this assessment is of the earlier run.</div>
            )}
            <ProductTruthTiles runId={runId} packet={truthPacket} />
          </div>
        )}
        {nodesInRun.has('review_mining') &&
          (progress.newerStageOne ? (
            <OutdatedVoice
              runId={runId}
              finished={!live}
              minedAt={runs.find((r) => r.id === run.source_run_id)?.created_at ?? ''}
              newerAt={progress.newerStageOne.created_at}
              onRunNode={onRunNode}
            />
          ) : (
            <div className="voice-tile">
              <VoiceAnalysis runId={runId} finished={!live} />
            </div>
          ))}

        {run.status === 'invalid' && (
          <section>
            <h3>Raw output</h3>
            <div className="trace">
              <ChatText text={run.output} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
