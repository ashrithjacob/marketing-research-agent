import type { ToolRow } from './steps';
import { toolVerb } from './steps';
import { Clip } from './parts';
import { InsideTool } from './InsideTool';
import { reactionIn, type CallIndex } from './turn';

function spanOf(rows: ToolRow[], now: number) {
  const starts = rows.map((r) => new Date(r.startedAt).getTime());
  const ends = rows.map((r) => (r.endedAt ? new Date(r.endedAt).getTime() : now));
  const t0 = Math.min(...starts);
  return { t0, span: Math.max(Math.max(...ends) - t0, 1) };
}

function stateLabel(row: ToolRow) {
  if (row.state === 'running') return 'RUNNING';
  if (row.state === 'error') return 'ERROR';
  if (row.service?.outcome === 'failed') return 'EMPTY';
  if (row.service?.outcome === 'degraded') return 'DEGRADED';
  return 'DONE';
}

function stateClass(row: ToolRow) {
  return row.state === 'done' && row.service && row.service.outcome !== 'ok' ? `${row.state} ${row.service.outcome}` : row.state;
}

function ToolLine({ row, index, t0, span, now }: {
  row: ToolRow;
  index: CallIndex;
  t0: number;
  span: number;
  now: number;
}) {
  const ask = row.callId ? index.asks.get(row.callId) : undefined;
  const answer = row.callId ? index.answers.get(row.callId) : undefined;
  const reaction = answer && row.state === 'error' ? reactionIn(index, answer.seq) : null;
  const start = new Date(row.startedAt).getTime();
  const end = row.endedAt ? new Date(row.endedAt).getTime() : now;
  const left = ((start - t0) / span) * 100;
  const width = Math.max(((end - start) / span) * 100, 1.5);
  const seconds = ((end - start) / 1000).toFixed(1);

  return (
    <details className={`tl-tool lane ${stateClass(row)}`}>
      <summary>
        <span className="tl-tool-n">#{ask?.index ?? '?'}</span>
        <span className="tl-tool-state">{stateLabel(row)}</span>
        <span className="tl-bar-track">
          <span className={`tl-bar ${stateClass(row)}`} style={{ left: `${left}%`, width: `${width}%` }} />
        </span>
        <span className="tl-tool-what">
          {toolVerb(row.tool)}
          {row.preview ? ` — ${row.preview}` : ''}
        </span>
        <span className="tl-tool-dur">{seconds}s</span>
      </summary>
      <div className="tl-tool-body">
        <p className="small">
          <span className="badge model">MODEL</span> asked for it
          {ask
            ? `: tool call ${ask.index} of ${ask.of} in turn #${ask.seq} · id ${ask.id}`
            : row.callId
              ? ` · id ${row.callId}`
              : ' (this run predates tool-call ids)'}
        </p>
        <p className="small">
          <span className="badge code">CODE</span> ran <code>{row.tool}</code>
          {row.endedAt ? ` in ${seconds}s` : ' — still running'}
        </p>
        <InsideTool row={row} />
        {ask && (
          <details className="sub">
            <summary>Arguments the model wrote</summary>
            <Clip text={JSON.stringify(ask.args ?? {}, null, 2)} mono />
          </details>
        )}
        {answer ? (
          <details className="sub" open={row.state === 'error'}>
            <summary>
              {answer.isError ? 'Model was told (error)' : 'Returned to the model'} — in turn #{answer.seq}'s prompt
            </summary>
            <Clip text={answer.text} mono />
          </details>
        ) : (
          row.errorText && <p className="tl-tool-err">{row.errorText}</p>
        )}
        {reaction && (
          <p className="small tl-next">
            ↳ What it did next, turn #{reaction.seq}: “{reaction.thought}”
            {reaction.asked.length > 0 && ` → asked for ${reaction.asked.join(', ')}`}
          </p>
        )}
      </div>
    </details>
  );
}

/** A turn's tool calls, numbered in the order the model wrote them, with bars showing which ran at once. */
export function ToolLane({ rows, index, now }: { rows: ToolRow[]; index: CallIndex; now: number }) {
  if (rows.length === 0) return null;
  const ordered = [...rows].sort(
    (a, b) => (index.asks.get(a.callId)?.index ?? 0) - (index.asks.get(b.callId)?.index ?? 0),
  );
  const { t0, span } = spanOf(rows, now);
  const parallel = rows.filter((r) => Math.abs(new Date(r.startedAt).getTime() - t0) < 250).length;
  return (
    <div className="tl-tools">
      <p className="small muted">
        {rows.length} tool call{rows.length === 1 ? '' : 's'}
        {parallel > 1 ? ` · ${parallel} started together and ran in parallel` : ''} · bars span{' '}
        {(span / 1000).toFixed(1)}s · the next turn waits for the slowest
      </p>
      {ordered.map((row) => (
        <ToolLine key={row.key} row={row} index={index} t0={t0} span={span} now={now} />
      ))}
    </div>
  );
}
