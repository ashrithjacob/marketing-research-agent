import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  streamRunEvents,
  TERMINAL_STATUSES,
  type Judgement,
  type ResearchNode,
  type RunDetail,
  type RunEvent,
  type RunSummary,
} from './api';
import { ChatText } from './FileBox';
import { LanesSection, applyToLanes, type Lane } from './run-view/lanes';
import { nowPanel } from './run-view/now';
import {
  AttributesSection,
  CompetitorsView,
  MeasurementsSection,
  SourcesSection,
} from './run-view/packet-sections';
import { RailColumn } from './run-view/rail';
import { RightRail } from './run-view/right-rail';
import { TraceSection, groupEvents } from './run-view/trace';

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
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [judgements, setJudgements] = useState<Judgement[]>([]);
  const [error, setError] = useState('');
  const traceRef = useRef<HTMLDivElement>(null);

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
    setEvents([]);
    setLanes([]);
    void reload();
  }, [runId, reload]);

  useEffect(() => {
    api.judgements().then(({ data }) => setJudgements(data)).catch(() => undefined);
  }, [judgementsRev]);

  useEffect(() => {
    const stop = streamRunEvents(runId, 0, {
      onEvent: (event) => {
        setEvents((current) => [...current, event]);
        applyToLanes(event, setLanes);
        if (event.kind.startsWith('run.') || event.kind.startsWith('packet.')) {
          void reload();
          onChanged();
        }
      },
      onEnd: () => void reload(),
      onError: (message) => setError(message),
    });
    return () => stop();
  }, [runId, reload, onChanged]);

  useEffect(() => {
    traceRef.current?.scrollTo({ top: traceRef.current.scrollHeight });
  }, [events.length]);

  const packet = run?.packet ?? null;
  const live = !!run && !TERMINAL_STATUSES.has(run.status);
  const sources = packet?.sources ?? [];
  const admitted = useMemo(() => sources.filter((s) => s.admitted), [sources]);
  const rejected = useMemo(() => sources.filter((s) => !s.admitted), [sources]);
  const unarchived = useMemo(
    () => admitted.filter((s) => !s.archived).length,
    [admitted],
  );

  const voice = useMemo(
    () => (packet?.excerpts ?? []).filter((e) => e.node === 'review_mining'),
    [packet],
  );

  const lastTool = useMemo(
    () => [...events].reverse().find((e) => e.kind === 'tool.started'),
    [events],
  );

  const traceRows = useMemo(() => groupEvents(events), [events]);

  if (!run) return <div className="empty">Loading run…</div>;

  const now = nowPanel(run, live, lastTool);

  return (
    <div className="cols">
      <RailColumn
        run={run}
        runs={runs}
        runId={runId}
        live={live}
        packet={packet}
        onSelectRun={onSelectRun}
        onRunNode={onRunNode}
      />

      <div className="mid">
        {error && <div className="error">{error}</div>}

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
    </div>
  </section>

        <LanesSection lanes={lanes} live={live} />
        <TraceSection events={events} traceRows={traceRows} traceRef={traceRef} />

        {packet && (packet.competitor_reference || (packet.competitors ?? []).length > 0) && (
          <CompetitorsView packet={packet} />
        )}
        {packet && (
          <SourcesSection
            runId={runId}
            sources={sources}
            admitted={admitted}
            rejected={rejected}
          />
        )}
        {packet && packet.attributes.length > 0 && (
          <AttributesSection attributes={packet.attributes} />
        )}
        {packet && packet.measurements.length > 0 && (
          <MeasurementsSection measurements={packet.measurements} />
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

      <RightRail
        run={run}
        packet={packet}
        unarchived={unarchived}
        voice={voice}
        judgements={judgements}
      />
    </div>
  );
}
