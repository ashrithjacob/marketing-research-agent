import type { ServiceReport, ToolStep } from '../api';
import type { ToolRow } from './steps';

function stepKind(step: ToolStep): string {
  if (step.name.startsWith('→')) return 'out';
  if (!step.name.startsWith('←')) return 'code';
  const status = /status="?([^"\s]+)/.exec(step.fields)?.[1] ?? '';
  return /^[45]\d\d$|^error/.test(status) ? 'back bad' : 'back';
}

export function ServiceLine({ report }: { report: ServiceReport }) {
  const answered = report.parts.filter((p) => p.ok).length;
  return (
    <p className={`small service ${report.outcome}`}>
      <b>{report.service}</b> ·{' '}
      {report.outcome === 'ok'
        ? 'every part answered'
        : report.outcome === 'failed'
          ? 'nothing answered'
          : `${answered} of ${report.parts.length} answered`}
      {report.parts.map((part) => (
        <span key={part.name} className={`svc-part ${part.ok ? 'ok' : 'bad'}`}>
          {part.ok ? '✓' : '✗'} {part.name}
          {part.detail ? ` — ${part.detail}` : ''}
        </span>
      ))}
    </p>
  );
}

/** What ran inside one tool call: each function it called and each request it sent, timed from the call's start. */
export function InsideTool({ row }: { row: ToolRow }) {
  const steps = row.inside ?? [];
  if (steps.length === 0 && !row.service) {
    return row.state === 'running' ? (
      <p className="small muted">What ran inside the tool appears when it finishes.</p>
    ) : null;
  }
  const t0 = new Date(row.startedAt).getTime();
  const requests = steps.filter((s) => s.name.startsWith('←'));
  return (
    <div className="inside">
      {row.service && <ServiceLine report={row.service} />}
      {steps.length > 0 && (
        <details className="sub" open={row.state === 'error' || row.service?.outcome !== 'ok'}>
          <summary>
            Inside the tool — {steps.length} line{steps.length === 1 ? '' : 's'} of code, {requests.length} request
            {requests.length === 1 ? '' : 's'} out and back
          </summary>
          <ol className="inside-steps">
            {steps.map((step, i) => (
              <li key={i} className={stepKind(step)}>
                <span className="st-t">+{((new Date(step.at).getTime() - t0) / 1000).toFixed(3)}s</span>
                <span className="st-f">{step.file}</span>
                <span className="st-n">{step.name}</span>
                {step.fields && <span className="st-x">{step.fields}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
