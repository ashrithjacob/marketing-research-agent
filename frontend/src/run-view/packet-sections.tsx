import { api } from '../api';
import type { Source } from '../api';

function SourceRow({ runId, source }: { runId: string; source: Source }) {
  const body = source.archived ? api.sourceUrl(runId, source.id) : null;
  return (
    <div className={`src-row ${source.admitted ? '' : 'rejected'}`}>
      <span className="st">{source.admitted ? 'ADMITTED' : 'SKIPPED'}</span>
      <span className="url" title={source.admission_reason || source.url}>
        {source.url}
      </span>
      <span className="kind">
        {source.kind}
        {source.marketing ? ' · marketing' : ''}
      </span>
      {body ? (
        <a className="archived" href={body} target="_blank" rel="noreferrer">
          body
        </a>
      ) : (
        <span className="archived off" title="not archived">
          —
        </span>
      )}
    </div>
  );
}

export function SourcesSection({
  runId,
  sources,
  admitted,
  rejected,
}: {
  runId: string;
  sources: Source[];
  admitted: Source[];
  rejected: Source[];
}) {
  return (
    <section>
      <h3>
        Sources{' '}
        <span className="n">
          {admitted.length} admitted · {rejected.length} rejected
        </span>
      </h3>
      <div className="src-list">
        {sources.map((source) => (
          <SourceRow key={source.id} runId={runId} source={source} />
        ))}
      </div>
    </section>
  );
}
