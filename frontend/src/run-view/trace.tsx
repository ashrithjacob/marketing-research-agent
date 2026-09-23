import type { RefObject } from 'react';
import type { Billed, RunEvent } from '../api';
import { ChatText } from '../FileBox';
import { formatTokens } from '../format';

function traceClass(kind: string): string {
  if (
    kind === 'run.steered' ||
    kind === 'run.nudged' ||
    kind === 'run.resumed' ||
    kind === 'packet.checked' ||
    kind === 'run.ended_early'
  ) {
    return 'rule';
  }
  if (kind === 'packet.invalid' || kind === 'run.failed') return 'bad';
  return '';
}

export interface TraceRow {
  /** First event id of the row — events are unique, so the key survives grouping. */
  id: number;
  message: boolean;
  cls: string;
  events: RunEvent[];
}

/** Consecutive `message.delta` chunks are one message; fences can span chunks, so merge before render. */
export function groupEvents(events: RunEvent[]): TraceRow[] {
  const rows: TraceRow[] = [];
  for (const event of events) {
    const isMessage = event.kind === 'message.delta';
    const last = rows[rows.length - 1];
    if (isMessage && last?.message) {
      last.events.push(event);
    } else {
      rows.push({
        id: event.id,
        message: isMessage,
        cls: traceClass(event.kind),
        events: [event],
      });
    }
  }
  return rows;
}

function traceText(event: RunEvent): string {
  const p = event.payload as Record<string, unknown>;
  switch (event.kind) {
    case 'run.started':
      return 'run admitted — stage 1, gather only';
    case 'tool.started':
      return `${p.tool}: ${p.preview ?? ''}`;
    case 'tool.completed':
      return `${p.tool} ${p.error ? 'failed' : 'done'}${
        p.duration ? ` in ${p.duration}s` : ''
      }`;
    case 'reasoning.available':
      return String(p.text ?? '');
    case 'run.steered':
      return `judgement applied mid-run — ${p.text ?? ''}`;
    case 'run.nudged':
      return 'the run ended without a packet — asked once more, tools off';
    case 'run.resumed':
      return (
        `the model stream dropped (${p.error || 'no detail'}) — retry ${p.attempt ?? 1} of 3` +
        `${p.delay_ms ? ` after ${(Number(p.delay_ms) / 1000).toFixed(1)}s` : ''}`
      );
    case 'packet.ready':
      return (
        `packet accepted${p.via === 'tool' ? ' (checked during the run)' : ''} — ` +
        `${p.sources} sources, ${p.excerpts} excerpts, ${p.gaps} gaps`
      );
    case 'packet.checked': {
      const problems = (p.problems as string[] | undefined) ?? [];
      return p.valid
        ? 'packet checked — valid, this is the run\'s result'
        : `packet checked — ${problems.length} problem${problems.length === 1 ? '' : 's'}: ${
            problems[0] ?? ''
          }${problems.length > 1 ? ` (+${problems.length - 1} more)` : ''}`;
    }
    case 'run.ended_early':
      return `the run ended early (${p.error || 'no detail'}) — the packet was already validated`;
    case 'packet.invalid':
      return `packet rejected — ${p.error ?? ''}`;
    case 'run.failed':
      return `run failed — ${p.error ?? ''}`;
    case 'llm.call': {
      const tokens = Number(p.input_tokens ?? 0) + Number(p.cache_read_tokens ?? 0);
      const tools = Number(p.tool_calls ?? 0);
      return (
        `LLM call ${p.seq} — ${(Number(p.duration_ms ?? 0) / 1000).toFixed(1)}s, ` +
        `${formatTokens(tokens)} in / ${formatTokens(Number(p.output_tokens ?? 0))} out, ` +
        `$${Number(p.cost ?? 0).toFixed(4)}` +
        (tools ? `, ${tools} tool call${tools === 1 ? '' : 's'}` : '') +
        (p.error ? ` — ${p.error}` : '')
      );
    }
    case 'run.billed': {
      const b = p.billed as Billed;
      return `OpenRouter billed $${b.total.toFixed(4)} — ${b.resolved} of ${b.turns} turns`;
    }
    default:
      return event.kind;
  }
}

export function TraceSection({
  events,
  traceRows,
  traceRef,
}: {
  events: RunEvent[];
  traceRows: TraceRow[];
  traceRef: RefObject<HTMLDivElement>;
}) {
  return (
  <section>
    <h3>
      Reasoning trace <span className="n">{events.length} events</span>
    </h3>
    <div className="trace" ref={traceRef}>
      {events.length === 0 && <p className="muted">Nothing yet.</p>}
      {traceRows.map((row) =>
        row.message ? (
          <div key={row.id} className="chatmsg">
            <span className="tag">
              {new Date(row.events[0].created_at).toLocaleTimeString()}
            </span>
            <ChatText
              text={row.events
                .map((e) => String((e.payload as { delta?: string }).delta ?? ''))
                .join('')}
            />
          </div>
        ) : (
          <p key={row.id} className={row.cls}>
            <span className="tag">
              {new Date(row.events[0].created_at).toLocaleTimeString()}
            </span>
            {traceText(row.events[0])}
          </p>
        ),
      )}
    </div>
  </section>
  );
}
