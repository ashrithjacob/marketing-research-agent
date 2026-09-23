import { useMemo, useState } from 'react';
import type { LlmCall } from '../api';
import { formatTokens } from '../format';
import { BlockView, Clip, Collapsible, MessageView, ToolsList } from './parts';

export function CallView({ call, calls, index }: { call: LlmCall; calls: LlmCall[]; index: number }) {
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
