import type { LlmCall } from '../api';
import { formatTokens } from '../format';
import { CallView } from './CallView';
import { Clip } from './parts';
import { turnSummary, type Step } from './steps';
import { ToolLane } from './ToolLane';
import {
  askedOf,
  firstLine,
  saidOf,
  sentCount,
  sentMessages,
  stopMeaning,
  thinkingOf,
  type CallIndex,
} from './turn';

function Sent({ call }: { call: LlmCall }) {
  const usage = call.usage ?? {};
  const messages = sentMessages(call);
  const sent = sentCount(call);
  return (
    <section className="turn-sec">
      <h5>1 · Sent to the model</h5>
      <p className="small muted">
        {call.error && !Number(usage.input ?? 0) && !Number(usage.cacheRead ?? 0)
          ? 'tokens in not reported: the stream failed before its last chunk, which carries the counts'
          : `${formatTokens(Number(usage.input ?? 0) + Number(usage.cacheRead ?? 0))} tokens in (${formatTokens(Number(usage.cacheRead ?? 0))} cached)`}{' '}
        ·{' '}{sent} new message
        {sent === 1 ? '' : 's'} on top of {call.context_messages - messages.length} already sent
        {messages.length > sent ? ` · ${messages.length - sent} dropped by pi-ai before sending` : ''}
      </p>
      <ul className="sent-list">
        {messages.map((m, i) => (
          <li key={i} className={m.label.startsWith('its failed') ? 'dropped' : ''}>
            <span className={`badge ${m.who}`}>{m.who.toUpperCase()}</span> {m.label}
            <span className="muted"> — {m.preview}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Output({ step, call }: { step: Step; call: LlmCall | undefined }) {
  const thinking = call ? thinkingOf(call) : step.reasoning.join('\n');
  const said = call ? saidOf(call) : step.message;
  const asked = askedOf(call);
  const usage = call?.usage ?? {};
  const g = call?.generation;
  return (
    <section className="turn-sec">
      <h5>
        2 · Model output <span className="badge model">MODEL</span>
      </h5>
      <p className="small muted">
        {g?.latency_ms != null ? `first token ${(g.latency_ms / 1000).toFixed(1)}s · ` : ''}
        {thinking.length.toLocaleString()} chars thinking
        {!call
          ? ' · still streaming'
          : call.error && !Number(usage.output ?? 0)
            ? ' · tokens out not reported (stream failed)'
            : ` · ${Number(usage.output ?? 0).toLocaleString()} tokens out`}
        {g?.reasoning_tokens != null ? ` (${g.reasoning_tokens.toLocaleString()} reasoning)` : ''}
      </p>
      <dl className="out-parts">
        <dt>Thinking</dt>
        <dd>
          {thinking ? (
            <details className="sub">
              <summary>“{firstLine(thinking)}”</summary>
              <Clip text={thinking} />
            </details>
          ) : (
            <span className="muted">none</span>
          )}
        </dd>
        <dt>Said</dt>
        <dd>{said ? <Clip text={said} /> : <span className="muted">nothing</span>}</dd>
        <dt>Asked to run</dt>
        <dd>
          {asked.length === 0 ? (
            <span className="muted">no tools</span>
          ) : (
            <ol className="asked">
              {asked.map((b) => (
                <li key={b.id}>
                  <code>{b.name}</code> <span className="muted">{JSON.stringify(b.arguments ?? {}).slice(0, 140)}</span>
                </li>
              ))}
            </ol>
          )}
        </dd>
      </dl>
      <p className={`small ${call?.error ? 'tl-tool-err' : ''}`}>→ {stopMeaning(call)}</p>
      {call && (
        <details className="sub">
          <summary>Raw JSON — the assembled message exactly as stored</summary>
          <Clip text={JSON.stringify(call.output, null, 2)} mono />
        </details>
      )}
    </section>
  );
}

export function TurnCard({ step, call, calls, index, now, isLast }: {
  step: Step;
  call: LlmCall | undefined;
  calls: LlmCall[];
  index: CallIndex;
  now: number;
  isLast: boolean;
}) {
  const failed = !!step.error;
  const usage = call?.usage ?? {};
  const firstAsk = askedOf(call).find((b) => b.id && index.answers.has(b.id));
  const nextSeq = firstAsk?.id ? index.answers.get(firstAsk.id)?.seq : undefined;
  return (
    <li className={`tl-step ${isLast ? 'last' : ''}`}>
      <span className={`tl-dot ${failed ? 'bad' : ''}`} />
      <details className={`tl-box ${failed ? 'failed' : ''}`}>
        <summary>
          <span className="badge model">MODEL</span>
          <span className="tl-title">
            {step.seq != null ? `Turn #${step.seq} · ` : ''}
            {turnSummary(step)}
          </span>
          <span className="tl-meta">
            {new Date(step.startedAt).toLocaleTimeString()}
            {call ? ` · ${(call.duration_ms / 1000).toFixed(1)}s` : ''}
            {call ? ` · ${formatTokens(Number(usage.output ?? 0))} out` : ''}
            {call?.billed_cost != null && ` · $${call.billed_cost.toFixed(4)}`}
          </span>
        </summary>
        <div className="tl-body">
          {call && <Sent call={call} />}
          <Output step={step} call={call} />
          {step.tools.length > 0 && (
            <section className="turn-sec">
              <h5>
                3 · Tools <span className="badge code">CODE</span>
              </h5>
              <ToolLane rows={step.tools} index={index} now={now} />
            </section>
          )}
          {nextSeq != null && (
            <p className="small turn-next">
              4 · → the {step.tools.length} result{step.tools.length === 1 ? '' : 's'} go into turn #{nextSeq}'s prompt,
              in the order the model asked for them
            </p>
          )}
          {call && (
            <details className="sub">
              <summary>Full LLM call — prompt and answer as sent</summary>
              <CallView call={call} calls={calls} index={calls.indexOf(call)} />
            </details>
          )}
        </div>
      </details>
    </li>
  );
}
