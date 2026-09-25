import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  TERMINAL_STATUSES,
  type Judgement,
  type ResearchNode,
  type RunDetail,
  type RunSummary,
  type Source,
} from './api';
import { ChatText } from './FileBox';
import { nowPanel, runStage } from './run-view/now';
import { RailColumn, subjectProgress } from './run-view/rail';
import { useRunStream } from './run-view/use-run-stream';
import { AngleMapTile } from './run-view/tiles-angle';
import { CompetitorsTile, VoiceTile } from './run-view/tiles-market';
import { CategoryTile, ProductTile } from './run-view/tiles-data';

export default function RunView({
  runId,
  runs,
  judgementsRev,
  onSelectRun,
  onChanged,
  onRunNode,
}: {
  runId: string;
  runs: RunSummary[];
  judgementsRev: number;
  onSelectRun: (id: string) => void;
  onChanged: () => void;
  onRunNode: (node: ResearchNode) => void;
}) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [judgements, setJudgements] = useState<Judgement[]>([]);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [detail, { data }] = await Promise.all([api.run(runId), api.judgements()]);
      setRun(detail);
      setJudgements(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [runId]);

  useEffect(() => {
    setRun(null);
    void reload();
  }, [runId, reload]);

  useEffect(() => {
    api.judgements().then(({ data }) => setJudgements(data)).catch(() => undefined);
  }, [judgementsRev]);

  const { lastTool, reconnecting } = useRunStream(runId, reload, onChanged, setError);

  const packet = run?.packet ?? null;
  const live = !!run && !TERMINAL_STATUSES.has(run.status);
  const sources = packet?.sources ?? [];
  const admitted = useMemo(() => sources.filter((s) => s.admitted), [sources]);
  const unarchived = useMemo(
    () => admitted.filter((s) => !s.archived).length,
    [admitted],
  );

  const byNode = useMemo(() => {
    const empty = {
      attributes: {} as Record<string, NonNullable<typeof packet>['attributes']>,
      measurements: {} as Record<string, NonNullable<typeof packet>['measurements']>,
      excerpts: {} as Record<string, NonNullable<typeof packet>['excerpts']>,
      sources: {} as Record<string, Source[]>,
      gaps: {} as Record<string, NonNullable<typeof packet>['gaps']>,
    };
    if (!packet) return empty;
    const map = {
      attributes: {} as Record<string, typeof packet.attributes>,
      measurements: {} as Record<string, typeof packet.measurements>,
      excerpts: {} as Record<string, typeof packet.excerpts>,
      sources: {} as Record<string, Source[]>,
      gaps: {} as Record<string, typeof packet.gaps>,
    };
    for (const a of packet.attributes) push(map.attributes, a.node, a);
    for (const m of packet.measurements) push(map.measurements, m.node, m);
    for (const e of packet.excerpts) push(map.excerpts, e.node, e);
    for (const s of packet.sources) push(map.sources, s.node, s);
    for (const g of packet.gaps) push(map.gaps, g.node, g);
    return map;
  }, [packet]);

  const voice = useMemo(
    () => (packet?.excerpts ?? []).filter((e) => e.node === 'review_mining'),
    [packet],
  );

  if (!run) return <div className="empty">Loading run…</div>;

  const now = nowPanel(run, live, lastTool);
  const progress = subjectProgress(runs, run);
  const nextStageTwo =
    run.status === 'completed' &&
    runStage(run) === 1 &&
    !progress.stageTwoDone &&
    !progress.stageTwoLive;
  const showCompetitors =
    packet && (packet.competitor_reference || (packet.competitors ?? []).length > 0);
  const nodesInRun = new Set((run.nodes ?? packet?.nodes.map((n) => n.node) ?? []) as string[]);

  return (
    <div className="cols two">
      <RailColumn
        run={run}
        runs={runs}
        runId={runId}
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

        {packet && (
          <div className="tiles">
            {nodesInRun.has('product_data') && (
              <ProductTile
                runId={runId}
                packet={packet}
                attributes={byNode.attributes.product_data ?? []}
                measurements={byNode.measurements.product_data ?? []}
                excerpts={byNode.excerpts.product_data ?? []}
                sources={byNode.sources.product_data ?? []}
                gaps={byNode.gaps.product_data ?? []}
              />
            )}
            {showCompetitors && (
              <CompetitorsTile
                runId={runId}
                packet={packet}
                measurements={byNode.measurements.competitors ?? []}
                excerpts={byNode.excerpts.competitors ?? []}
                sources={byNode.sources.competitors ?? []}
                gaps={byNode.gaps.competitors ?? []}
              />
            )}
            {nodesInRun.has('category_data') && (
              <CategoryTile
                runId={runId}
                measurements={byNode.measurements.category_data ?? []}
                sources={byNode.sources.category_data ?? []}
                gaps={byNode.gaps.category_data ?? []}
              />
            )}
            {(voice.length > 0 || nodesInRun.has('review_mining')) && (
              <VoiceTile voice={voice} />
            )}
            <AngleMapTile />
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

function push<T extends { node: string }>(
  map: Record<string, T[]>,
  node: string,
  item: T,
) {
  (map[node] ??= []).push(item);
}
