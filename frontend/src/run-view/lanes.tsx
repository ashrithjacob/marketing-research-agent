import type { RunEvent } from '../api';

export interface Lane {
  key: string;
  tool: string;
  kind: string;
  preview: string;
  state: 'running' | 'done' | 'error';
}

/** No correlation id upstream, so a completion settles the newest running lane for that tool. */
export function applyToLanes(
  event: RunEvent,
  setLanes: (fn: (current: Lane[]) => Lane[]) => void,
) {
  const payload = event.payload as Record<string, string | boolean>;
  if (event.kind === 'tool.started') {
    setLanes((current) => [
      ...current,
      {
        key: `${event.id}`,
        tool: String(payload.tool ?? ''),
        kind: String(payload.lane ?? 'other'),
        preview: String(payload.preview ?? ''),
        state: 'running',
      },
    ]);
  } else if (event.kind === 'tool.completed') {
    setLanes((current) => {
      const reversed = [...current]
        .reverse()
        .findIndex((l) => l.tool === payload.tool && l.state === 'running');
      if (reversed === -1) return current;
      const at = current.length - 1 - reversed;
      const next = [...current];
      next[at] = { ...next[at], state: payload.error ? 'error' : 'done' };
      return next;
    });
  }
}

export function LanesSection({ lanes, live }: { lanes: Lane[]; live: boolean }) {
  return (
  <section>
    <h3>
      Crawling <span className="n">{live ? 'live' : `${lanes.length} calls`}</span>
    </h3>
    <div className="lanes">
      {lanes.length === 0 && <p className="muted">No activity yet.</p>}
      {lanes.slice(-8).map((lane) => (
        <div key={lane.key} className={`lane ${lane.state}`}>
          <span className="st">
            {lane.state === 'running'
              ? lane.kind === 'search'
                ? 'SEARCH'
                : lane.kind === 'corpus'
                  ? 'WRITE'
                  : 'FETCH'
              : lane.state === 'error'
                ? 'ERROR'
                : 'DONE'}
          </span>
          <div className="lane-body">
            <div className="url">{lane.preview || lane.tool}</div>
            {lane.state === 'running' && (
              <div className="bar">
                <i />
              </div>
            )}
          </div>
          <span className="kind">{lane.tool}</span>
        </div>
      ))}
    </div>
  </section>
  );
}
