import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  briefLabel,
  streamRunEvents,
  type CallStats,
  type ContentBlock,
  type LlmCall,
  type RunSummary,
  type TraceMessage,
} from './api';
import { formatTokens } from './RunView';
import { scopeLabel } from './StageRail';

/**
 * Every LLM call a run made: what was sent, what came back, and what it cost.
 *
 * Opened in its own tab (`/runs/<id>/logs`) so it can sit beside the cockpit
 * while a run is live. It follows the run's event stream and, on each
 * `llm.call`, fetches only the calls it does not have yet — a run's trace is
 * megabytes, and re-fetching it per call would be quadratic.
 *
 * The server stores each call's *new* input only (see `LlmCall`). "Full
 * prompt" rebuilds the exact context from those deltas rather than asking the
 * server for a second copy.
 */

type RunInfo = RunSummary & { live: boolean };

export default function LogsPage({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunInfo | null>(null);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [calls, setCalls] = useState<LlmCall[]>([]);
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  const lastSeq = useRef(0);
  const inFlight = useRef(false);
  const queued = useRef<'none' | 'new' | 'full'>('none');

  /** Coalesced: a burst of events becomes one fetch, and a full refetch wins over "new only". */
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
        if (event.kind === 'llm.call') void refresh('new');
        // Billed costs land on calls already fetched, after the run settles.
        else if (event.kind === 'run.billed') void refresh('full');
        else if (event.kind.startsWith('run.') || event.kind.startsWith('packet.')) {
          void refresh('new');
        }
      },
      onEnd: () => void refresh('full'),
      onError: (message) => setError(message),
    });
    return () => stop();
  }, [runId, refresh]);

  // The wall clock ticks while the run is live; everything else moves on events.
  useEffect(() => {
    if (!run?.live) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [run?.live]);

  useEffect(() => {
    if (run) document.title = `Logs · ${briefLabel(run.brief)}`;
  }, [run]);

  const wallMs = run
    ? run.live
      ? Date.now() - new Date(run.created_at).getTime()
      : (stats?.wall_time_ms ?? 0)
    : 0;

  return (
    <div className="app logs">
      <header>
        <span className="brand">research cockpit</span>
        <span className="brand-sub">LLM call log</span>
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
            <Stat label="Cost (calculated)" value={`$${stats.cost.toFixed(4)}`}
              sub="token counts × the run's rates" />
            <Stat label="Billed by OpenRouter"
              value={stats.billed.resolved ? `$${stats.billed.total.toFixed(4)}` : '—'}
              sub={stats.billed.resolved
                ? `${stats.billed.resolved} of ${stats.llm_calls} calls read back`
                : run.live ? 'read back after each call' : 'not read back'} />
            <Stat label="Tool calls" value={String(stats.tool_calls)}
              sub={stats.tool_errors ? `${stats.tool_errors} failed` : ''} />
          </div>
        )}

        {run && calls.length === 0 && (
          <p className="muted">
            {run.live
              ? 'No LLM call has finished yet.'
              : 'No LLM calls were recorded for this run. Runs from before the call log existed have none.'}
          </p>
        )}

        <div className="calls">
          {calls.map((call, index) => (
            <CallView key={call.seq} call={call} calls={calls} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

function CallView({ call, calls, index }: { call: LlmCall; calls: LlmCall[]; index: number }) {
  const [full, setFull] = useState(false);
  const usage = call.usage ?? {};
  const answer = call.output?.content ?? [];
  const toolCalls = answer.filter((b) => b.type === 'toolCall');
  const failed = call.error !== '';
  const context = useMemo(() => (full ? contextAt(calls, index) : null), [full, calls, index]);

  return (
    <details className={`call ${failed ? 'failed' : ''}`}>
      <summary>
        <span className="call-n">#{call.seq}</span>
        <span className="call-t">{new Date(call.started_at).toLocaleTimeString()}</span>
        <span>{(call.duration_ms / 1000).toFixed(1)}s</span>
        <span>
          {formatTokens((usage.input ?? 0) + (usage.cacheRead ?? 0))} in ·{' '}
          {formatTokens(usage.output ?? 0)} out
        </span>
        <span>${(usage.cost?.total ?? 0).toFixed(4)}</span>
        <span className="call-stop">{failed ? `error: ${call.error}` : call.stop_reason}</span>
        <span className="call-what">
          {toolCalls.length
            ? toolCalls.map((b) => b.name).join(', ')
            : answer.some((b) => b.type === 'text' && (b.text ?? '').includes('```json'))
              ? 'final answer (packet)'
              : ''}
        </span>
      </summary>

      <div className="call-body">
        <section>
          <h4>
            Prompt{' '}
            <span className="n">
              {call.context_reset
                ? `full context, ${call.context_messages} messages`
                : `${call.input.length} new of ${call.context_messages} messages`}
            </span>
            <button className="ghost small-btn" onClick={() => setFull((f) => !f)}>
              {full ? 'Show only what is new' : 'Show full prompt'}
            </button>
          </h4>

          {context ? (
            <>
              <Collapsible title="System prompt">
                <Clip text={context.system ?? '(not recorded)'} />
              </Collapsible>
              <ToolsList tools={context.tools} />
              {context.messages.map((m, i) => (
                <MessageView key={i} message={m} />
              ))}
            </>
          ) : (
            <>
              {call.system_prompt !== null && (
                <Collapsible title="System prompt">
                  <Clip text={call.system_prompt} />
                </Collapsible>
              )}
              {call.tools !== null && <ToolsList tools={call.tools} />}
              {index > 0 && !call.context_reset && (
                <p className="muted small">
                  Continues the {call.context_messages - call.input.length} messages sent in
                  earlier calls. New in this call:
                </p>
              )}
              {call.input.map((m, i) => (
                <MessageView key={i} message={m} />
              ))}
            </>
          )}
        </section>

        <section>
          <h4>
            Answer{' '}
            <span className="n">
              {call.model}
              {call.response_id ? ` · ${call.response_id}` : ''}
            </span>
          </h4>
          {failed && <div className="error">{call.error}</div>}
          {answer.length === 0 && !failed && <p className="muted">(empty)</p>}
          {answer.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
          <div className="call-usage">
            input {usage.input ?? 0} · cache read {usage.cacheRead ?? 0} · cache write{' '}
            {usage.cacheWrite ?? 0} · output {usage.output ?? 0}
            {usage.reasoning ? ` (of which reasoning ${usage.reasoning})` : ''} · calculated $
            {(usage.cost?.total ?? 0).toFixed(6)}
            {call.billed_cost !== null ? ` · billed $${call.billed_cost.toFixed(6)}` : ''}
          </div>
        </section>
      </div>
    </details>
  );
}

/**
 * The exact context call `index` was sent: the latest system prompt and tools
 * at or before it, and every input from the last context reset up to it.
 */
function contextAt(calls: LlmCall[], index: number) {
  let start = 0;
  for (let k = index; k >= 0; k--) {
    if (calls[k].context_reset) {
      start = k;
      break;
    }
  }
  let system: string | null = null;
  let tools: LlmCall['tools'] = null;
  for (let k = index; k >= 0 && (system === null || tools === null); k--) {
    if (system === null && calls[k].system_prompt !== null) system = calls[k].system_prompt;
    if (tools === null && calls[k].tools !== null) tools = calls[k].tools;
  }
  const messages = calls.slice(start, index + 1).flatMap((c) => c.input);
  return { system, tools, messages };
}

function ToolsList({ tools }: { tools: LlmCall['tools'] }) {
  if (!tools) return null;
  return (
    <Collapsible title={`Tools offered (${tools.length}): ${tools.map((t) => t.name).join(', ')}`}>
      {tools.map((tool) => (
        <div key={tool.name} className="tool-def">
          <b>{tool.name}</b> — {tool.description}
          <Clip text={JSON.stringify(tool.parameters, null, 2)} mono />
        </div>
      ))}
    </Collapsible>
  );
}

function MessageView({ message }: { message: TraceMessage }) {
  const label =
    message.role === 'toolResult'
      ? `tool result · ${message.toolName ?? ''}${message.isError ? ' · error' : ''}`
      : message.role === 'assistant'
        ? 'assistant · its previous answer'
        : message.role;
  const blocks: ContentBlock[] =
    typeof message.content === 'string'
      ? [{ type: 'text', text: message.content }]
      : message.content;
  return (
    <div className={`msg ${message.role} ${message.isError ? 'error' : ''}`}>
      <div className="msg-role">{label}</div>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: ContentBlock }) {
  if (block.type === 'thinking') {
    return (
      <Collapsible title="thinking" className="thinking">
        <Clip text={block.thinking ?? block.text ?? ''} />
      </Collapsible>
    );
  }
  if (block.type === 'toolCall') {
    return (
      <div className="toolcall">
        <span className="toolcall-name">→ {block.name}</span>
        <Clip text={JSON.stringify(block.arguments ?? {}, null, 2)} mono />
      </div>
    );
  }
  if (block.type === 'text') return <Clip text={block.text ?? ''} />;
  return <p className="muted small">[{block.type}]</p>;
}

function Collapsible({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details className={`sub ${className ?? ''}`}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

/** Long text — a fetched page can be 60k characters — shown in part until asked. */
function Clip({ text, mono }: { text: string; mono?: boolean }) {
  const LIMIT = 4000;
  const [all, setAll] = useState(false);
  const long = text.length > LIMIT;
  return (
    <div className={`clip ${mono ? 'mono' : ''}`}>
      <pre>{all || !long ? text : `${text.slice(0, LIMIT)}…`}</pre>
      {long && (
        <button className="ghost small-btn" onClick={() => setAll((a) => !a)}>
          {all ? 'Show less' : `Show all ${text.length.toLocaleString()} characters`}
        </button>
      )}
    </div>
  );
}

function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
