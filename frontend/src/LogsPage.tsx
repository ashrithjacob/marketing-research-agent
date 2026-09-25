import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  briefLabel,
  streamRunEvents,
  type CallStats,
  type LlmCall,
  type RunEvent,
  type RunSummary,
} from './api';
import { formatTokens } from './format';
import { scopeLabel } from './StageRail';
import { Stat, duration } from './logs/parts';
import { buildSteps } from './logs/steps';
import { Timeline } from './logs/timeline';

/** Every action a run took, one box at a time: what it did, then what it cost. */
type RunInfo = RunSummary & { live: boolean };

export default function LogsPage({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunInfo | null>(null);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [calls, setCalls] = useState<LlmCall[]>([]);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState('');
  const [reconnecting, setReconnecting] = useState('');
  const [, setTick] = useState(0);

  const lastSeq = useRef(0);
  const inFlight = useRef(false);
  const queued = useRef<'none' | 'new' | 'full'>('none');
  const timelineRef = useRef<HTMLOListElement>(null);
  const liveRef = useRef(false);

  const refresh = useCallback(
    async (mode: 'new' | 'full') => {
      if (inFlight.current) {
        if (queued.current !== 'full') queued.current = mode;
        return;
      }
      inFlight.current = true;
      try {
        let next: 'none' | 'new' | 'full' = mode;
        while (next !== 'none') {
          queued.current = 'none';
          const full = next === 'full';
          const res = await api.calls(runId, full ? 0 : lastSeq.current);
          const newest = res.calls.reduce((max, c) => Math.max(max, c.seq), 0);
          lastSeq.current = full ? newest : Math.max(lastSeq.current, newest);
          setRun(res.run);
          liveRef.current = res.run.live;
          setStats(res.stats);
          setCalls((current) => {
            const merged = full ? [] : [...current];
            const have = new Set(merged.map((c) => c.seq));
            for (const call of res.calls) if (!have.has(call.seq)) merged.push(call);
            return merged.sort((a, b) => a.seq - b.seq);
          });
          next = queued.current;
        }
        setError('');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        inFlight.current = false;
      }
    },
    [runId],
  );

  useEffect(() => {
    void refresh('full');
    const stop = streamRunEvents(runId, 0, {
      onEvent: (event) => {
        setEvents((current) => [...current, event]);
        if (event.kind === 'llm.call') void refresh('new');
        else if (event.kind === 'run.billed') void refresh('full');
        else if (event.kind === 'apify.charged') void refresh('new');
        else if (event.kind.startsWith('run.') || event.kind.startsWith('packet.')) {
          void refresh('new');
        }
      },
      onEnd: () => void refresh('full'),
      onError: (message) => setError(message),
      onReconnecting: (attempt, reason) => setReconnecting(`${reason} — reconnecting (attempt ${attempt})`),
      onConnected: () => setReconnecting(''),
    });
    return () => stop();
  }, [runId, refresh]);

  useEffect(() => {
    if (!run?.live) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [run?.live]);

  useEffect(() => {
    if (run) document.title = `Activity · ${briefLabel(run.brief)}`;
  }, [run]);

  const live = !!run?.live;
  useEffect(() => {
    if (live) {
      timelineRef.current?.scrollTo({
        top: timelineRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [events.length, live]);

  const steps = useMemo(() => buildSteps(events), [events]);

  const wallMs = run
    ? run.live
      ? Date.now() - new Date(run.created_at).getTime()
      : (stats?.wall_time_ms ?? 0)
    : 0;

  return (
    <div className="app logs">
      <header>
        <span className="brand">research cockpit</span>
        <span className="brand-sub">activity log</span>
        <div className="subject">
          {run && (
            <>
              <span className="chip">
                {briefLabel(run.brief)}
                {run.brief.market ? ` — ${run.brief.market}` : ''}
              </span>
              <span className="chip">Stage {run.stage} · {scopeLabel(run.nodes ?? [])}</span>
              <span className={`status ${run.status}`}>{run.status}</span>
            </>
          )}
          <a className="ghost logs-back" href="/">
            ← Cockpit
          </a>
        </div>
      </header>

      {error && <div className="error banner">{error}</div>}
      {reconnecting && <div className="warn banner">Live updates paused: {reconnecting}</div>}

      <div className="logs-body">
        {!run && !error && <p className="muted">Loading…</p>}
        {run && stats && (
          <div className="logs-stats">
            <Stat label="LLM calls" value={String(stats.llm_calls)}
              sub={stats.llm_errors ? `${stats.llm_errors} failed` : run.live ? 'live' : ''} />
            <Stat label="Time taken" value={duration(wallMs)}
              sub={`${duration(stats.llm_time_ms)} waiting on the model`} />
            <Stat label="Tokens" value={formatTokens(stats.tokens.total)}
              sub={`${formatTokens(stats.tokens.input)} in · ${formatTokens(stats.tokens.cache_read)} cached · ${formatTokens(stats.tokens.output)} out`} />
            {run.stage === 2 ? (
              <Stat label="Apify crawler costs"
                value={stats.apify?.runs ? `$${stats.apify.total.toFixed(4)}` : '—'}
                sub={stats.apify?.runs
                  ? `${stats.apify.runs} actor run${stats.apify.runs === 1 ? '' : 's'} charged`
                  : run.live ? 'charged as each actor run ends' : 'no actor runs charged'} />
            ) : (
              <Stat label="Cost (calculated)" value={`$${stats.cost.toFixed(4)}`}
                sub="token counts × the run's rates" />
            )}
            <Stat label="Billed by OpenRouter"
              value={stats.billed.resolved ? `$${stats.billed.total.toFixed(4)}` : '—'}
              sub={stats.billed.resolved
                ? `${stats.billed.resolved} of ${stats.llm_calls} calls read back`
                : run.live ? 'read back after each call' : 'not read back'} />
            <Stat label="Tool calls" value={String(stats.tool_calls)}
              sub={stats.tool_errors ? `${stats.tool_errors} failed` : ''} />
          </div>
        )}

        {run && steps.length === 0 && (
          <p className="muted">
            {run.live
              ? 'No activity yet — the run is starting up.'
              : 'No activity was recorded for this run.'}
          </p>
        )}

        <ol className="timeline-scroll" ref={timelineRef}>
          <Timeline steps={steps} calls={calls} />
        </ol>
      </div>
    </div>
  );
}
