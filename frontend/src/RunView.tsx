import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  TERMINAL_STATUSES,
  type Judgement,
  type ResearchNode,
  type RunDetail,
  type RunSummary,
} from './api';
import { ChatText } from './FileBox';
import { nowPanel, runStage } from './run-view/now';
import { RailColumn, subjectProgress } from './run-view/rail';
import { StageOneTiles } from './run-view/stage-one-tiles';
import { useRunStream } from './run-view/use-run-stream';
import { VoiceAnalysis } from './run-view/voice/VoiceAnalysis';

export default function RunView({
  runId,
  runs,
  nav,
  judgementsRev,
  onSelectRun,
  onChanged,
  onRunNode,
}: {
  runId: string;
  runs: RunSummary[];
  nav: ReactNode;
  judgementsRev: number;
  onSelectRun: (id: string) => void;
  onChanged: () => void;
  onRunNode: (node: ResearchNode) => void;
}) {
  const [loaded, setLoaded] = useState<RunDetail | null>(null);
  const [judgements, setJudgements] = useState<Judgement[]>([]);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [detail, { data }] = await Promise.all([api.run(runId), api.judgements()]);
      setLoaded(detail);
      setJudgements(data);
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
  const { lastTool, reconnecting } = useRunStream(runId, reload, onChanged, setError);

  const packet = run?.packet ?? null;
  const live = !!run && !TERMINAL_STATUSES.has(run.status);
  const sources = packet?.sources ?? [];
  const admitted = useMemo(() => sources.filter((s) => s.admitted), [sources]);
  const unarchived = useMemo(
    () => admitted.filter((s) => !s.archived).length,
    [admitted],
  );

  if (!run) return <div className="empty">Loading run…</div>;

  const now = nowPanel(run, live, lastTool);
  const progress = subjectProgress(runs, run);
  const nextStageTwo =
    run.status === 'completed' &&
    runStage(run) === 1 &&
    !progress.stageTwoDone &&
    !progress.stageTwoLive;
  const nodesInRun = new Set((run.nodes ?? packet?.nodes.map((n) => n.node) ?? []) as string[]);

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
            <b>Packet rejected.</b> {run.error}
            <div className="error-note">
              The agent finished and what it produced broke the stage-1 contract.
              That is a more useful failure than a crash — the raw output is below.
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
          {nextStageTwo && (
            <div className="next-stage">
              <div className="txt">
                <b>Next: Stage 2 · Review mining</b>
                <div className="sub">
                  Stage 1 is in. Mine verbatim customer language from the reviews of the
                  product it found — you approve the plan before anything runs.
                </div>
              </div>
              <button className="primary" onClick={() => onRunNode('review_mining')}>
                Start stage 2 →
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

        {packet && runStage(run) === 1 && (
          <div className="tiles">
            <StageOneTiles runId={runId} packet={packet} nodes={nodesInRun} />
          </div>
        )}
        {nodesInRun.has('review_mining') && (
          <div className="voice-tile">
            <VoiceAnalysis runId={runId} finished={!live} />
          </div>
        )}

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
