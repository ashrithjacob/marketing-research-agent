import { Fragment, useMemo } from 'react';
import type { LlmCall } from '../api';
import { formatTokens } from '../format';
import { CallView } from './CallView';
import { turnSummary, toolVerb, type Step } from './steps';

function TurnBox({
  step,
  call,
  calls,
  isLast,
}: {
  step: Step;
  call: LlmCall | undefined;
  calls: LlmCall[];
  isLast: boolean;
}) {
  const usage = call?.usage ?? {};
  const tokensIn = Number(usage.input ?? 0) + Number(usage.cacheRead ?? 0);
  const failed = !!step.error;
  return (
    <li className={`tl-step ${isLast ? 'last' : ''}`}>
      <span className={`tl-dot ${failed ? 'bad' : ''}`} />
      <details className={`tl-box ${failed ? 'failed' : ''}`}>
        <summary>
          <span className="tl-title">{turnSummary(step)}</span>
          <span className="tl-meta">
            {new Date(step.startedAt).toLocaleTimeString()}
            {step.tools.length > 0 && ` · ${step.tools.length} tool call${step.tools.length === 1 ? '' : 's'}`}
            {tokensIn > 0 && ` · ${formatTokens(tokensIn)} in · ${formatTokens(Number(usage.output ?? 0))} out`}
            {Number(usage.cost?.total ?? 0) > 0 && ` · $${Number(usage.cost?.total ?? 0).toFixed(4)}`}
          </span>
        </summary>
        <div className="tl-body">
          {step.reasoning.length > 0 && (
            <details className="tl-sub">
              <summary>Reasoning trace ({step.reasoning.length})</summary>
              {step.reasoning.map((text, index) => (
                <p key={index} className="tl-reasoning">
                  {text}
                </p>
              ))}
            </details>
          )}
          {step.tools.length > 0 && (
            <div className="tl-tools">
              {step.tools.map((tool) => (
                <div key={tool.key} className={`tl-tool ${tool.state}`}>
                  <span className="tl-tool-state">
                    {tool.state === 'running' ? 'RUNNING' : tool.state === 'error' ? 'ERROR' : 'DONE'}
                  </span>
                  <span className="tl-tool-what">
                    {toolVerb(tool.tool)}
                    {tool.preview ? ` — ${tool.preview}` : ''}
                  </span>
                  {tool.duration ? <span className="tl-tool-dur">{tool.duration}s</span> : null}
                </div>
              ))}
            </div>
          )}
          {step.message && (
            <details className="tl-sub">
              <summary>Model output</summary>
              <p className="tl-message">{step.message}</p>
            </details>
          )}
          {call && <CallView call={call} calls={calls} index={calls.indexOf(call)} />}
        </div>
      </details>
    </li>
  );
}

function MilestoneBox({ step }: { step: Step }) {
  return (
    <li className={`tl-step milestone ${step.cls}`}>
      <span className={`tl-dot ${step.cls}`} />
      <div className="tl-box flat">
        <span className="tl-title">{step.text}</span>
        <span className="tl-meta">{new Date(step.startedAt).toLocaleTimeString()}</span>
      </div>
    </li>
  );
}

/** The vertical timeline: one box per agent action, joined by a line, top to bottom. */
export function Timeline({
  steps,
  calls,
}: {
  steps: Step[];
  calls: LlmCall[];
}) {
  const bySeq = useMemo(() => new Map(calls.map((c) => [c.seq, c])), [calls]);
  return (
    <ol className="timeline">
      {steps.map((step, index) => (
        <Fragment key={step.key}>
          {step.kind === 'turn' ? (
            <TurnBox
              step={step}
              call={step.seq != null ? bySeq.get(step.seq) : undefined}
              calls={calls}
              isLast={index === steps.length - 1}
            />
          ) : (
            <MilestoneBox step={step} />
          )}
        </Fragment>
      ))}
    </ol>
  );
}
