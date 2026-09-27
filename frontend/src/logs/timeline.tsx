import { Fragment, useMemo } from 'react';
import type { LlmCall } from '../api';
import type { Step } from './steps';
import { TurnCard } from './TurnCard';
import { indexCalls } from './turn';

function MilestoneBox({ step }: { step: Step }) {
  return (
    <li className={`tl-step milestone ${step.cls}`}>
      <span className={`tl-dot ${step.cls}`} />
      <div className="tl-box flat">
        {step.origin && <span className={`badge ${step.origin}`}>{step.origin.toUpperCase()}</span>}
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
  const index = useMemo(() => indexCalls(calls), [calls]);
  const now = Date.now();
  return (
    <ol className="timeline">
      {steps.map((step, position) => (
        <Fragment key={step.key}>
          {step.kind === 'turn' ? (
            <TurnCard
              step={step}
              call={step.seq != null ? index.bySeq.get(step.seq) : undefined}
              calls={calls}
              index={index}
              now={now}
              isLast={position === steps.length - 1}
            />
          ) : (
            <MilestoneBox step={step} />
          )}
        </Fragment>
      ))}
    </ol>
  );
}
